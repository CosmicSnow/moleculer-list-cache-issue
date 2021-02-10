const ms = require('ms');
const EventEmitter2 = require('eventemitter2').EventEmitter2;

/**
 * Queue Class
 */
class Queue extends EventEmitter2 {
    constructor(options) {
        let {queueSize = 10, eeOptions = {}} = options;
        super(eeOptions);

        this.queueSize = queueSize;
        this.queue = [];
    }

    updateQueue(options) {
        let {queueSize = 10} = options;

        this.queueSize = queueSize;
        this.queue = this.queue || [];
    }

    async enqueue(item) {
        if (this.queue.length >= this.queueSize) {
            this.emit('queueFull', {queueSize: this.queueSize, queue: this.queue.length, item});
            throw new Error(`Queue is full, queue size is ${this.queueSize}`);
        } else {
            return this.queue.push(item);
        }
    }

    async dequeue() {
        if (this.queue.length) {
            let item = this.queue.shift();
            if (!this.queue.length) {
                this.emit('queueEmpty', {queue: this.queue.length});
            }
            return item;
        } else {
            throw new Error(`Queue is empty`);
        }
    }
}

/**
 * TokenThrottler Class
 */
class TokenThrottler extends Queue {
    constructor(options) {
        let {
            timeWindow = 1000,
            tokensPerWindow = 10,
            maxTokens = tokensPerWindow,
            queueSize = tokensPerWindow,
            eeOptions
        } = options;

        super({queueSize, eeOptions});

        this.timeWindow = timeWindow;
        this.tokensPerWindow = tokensPerWindow;
        this.maxTokens = maxTokens;
        this.queueSize = queueSize;

        if (typeof timeWindow !== 'number') {
            timeWindow = ms(timeWindow) || 1000;
        }


        this.interval = timeWindow / tokensPerWindow;
        if (this.interval < 10) {
            this.interval = 10;
        }
        this.tokensPerInterval = Math.round(tokensPerWindow / (timeWindow / this.interval));
        this.bucket = 0;

        setTimeout(_ => {
            this.emit('started', {
                timeWindow: this.timeWindow,
                tokensPerWindow: this.tokensPerWindow,
                interval: this.interval,
                tokensPerInterval: this.tokensPerInterval,
                maxTokens: this.maxTokens,
                queueSize: this.queueSize,
            });
        });


        setInterval(() => {
            if ((this.bucket + this.tokensPerInterval) <= maxTokens) {
                this.bucket += this.tokensPerInterval;
            } else {
                this.emit('tokenBucketOverflow', {
                    tokens: this.bucket,
                    queue: this.queue.length,
                    overflow: (this.bucket + this.tokensPerInterval - maxTokens)
                });
                this.bucket = maxTokens;
            }
            this.runTask();
        }, this.interval)
    }

    updateQueue(options) {
        let {
            timeWindow = 1000,
            tokensPerWindow = 10,
            maxTokens = tokensPerWindow,
            queueSize = tokensPerWindow,
            eeOptions
        } = options;

        super.updateQueue({queueSize, eeOptions});

        this.timeWindow = timeWindow;
        this.tokensPerWindow = tokensPerWindow;
        this.maxTokens = maxTokens;
        this.queueSize = queueSize;

        this.interval = timeWindow / tokensPerWindow;
        if (this.interval < 10) {
            this.interval = 10;
        }
        this.tokensPerInterval = Math.round(tokensPerWindow / (timeWindow / this.interval));
        this.bucket = this.bucket || 0;
    }

    enqueue(task) {
        return new Promise(resolve => {
            super.enqueue({task, resolve}).then(() => {
                return this.runTask();
            }, err => {
                resolve(Promise.reject(err));
            });
        });
    }

    async runTask() {
        if (this.bucket && this.queue.length) {
            this.bucket--;

            if (!this.bucket) {
                this.emit('tokenStarvation', {tokens: this.bucket, queue: this.queue.length - 1});
            }

            let {task, resolve} = await this.dequeue();

            try {
                let result = await task();
                resolve(result);
            } catch (e) {
                resolve(Promise.reject(e));
            }
            return this.runTask();
        }
    }
}

/**
 * Throttler Class
 */
class Throttler extends Queue {
    constructor(options) {
        let {maxSimultaneous = 10, queueSize = 10, eeOptions} = options;
        super({queueSize, eeOptions});

        this.maxSimultaneous = maxSimultaneous;
        this.simultaneous = 0;

        setTimeout(_ => {
            this.emit('started', {
                maxSimultaneous,
                queueSize,
            });
        });

    }

    updateQueue(options) {
        let {maxSimultaneous = 10, queueSize = 10} = options;
        super.updateQueue({queueSize});

        this.maxSimultaneous = maxSimultaneous;
        this.simultaneous = this.simultaneous || 0;

        setTimeout(_ => {
            this.emit('started', {
                maxSimultaneous,
                queueSize,
            });
        });
    }

    enqueue(task) {
        return new Promise(resolve => {
            super.enqueue({task, resolve}).then(() => {
                return this.runTask()
                    .catch(() => {
                    });
            }, err => {
                resolve(Promise.reject(err));
            });
        });
    }

    async runTask() {
        if (this.simultaneous < this.maxSimultaneous && this.queue.length) {
            this.simultaneous++;

            if (this.simultaneous === this.maxSimultaneous) {
                this.emit('maxSimultaneous', {simultaneous: this.simultaneous, queue: this.queue.length - 1});
            }

            let {task, resolve} = await this.dequeue();

            try {
                let result = await task();
                resolve(result);
            } catch (e) {
                resolve(Promise.reject(e));
            }

            this.simultaneous--;
            return this.runTask();
        }
    }
}


/**
 * FullThrottler Class
 *
 * A combination of Throttler and TokenThrottler
 *
 * Primary simultaneous an secondary Tokens
 */
class FullThrottler extends Throttler {
    constructor(options) {
        let {maxSimultaneous, timeWindow, tokensPerWindow, maxTokens, queueSize, eeOptions} = options;
        super({maxSimultaneous, queueSize, eeOptions});
        this.tt = new TokenThrottler({timeWindow, tokensPerWindow, maxTokens, queueSize: maxSimultaneous});

        this.tt.onAny((event, data) => {
            if (event === 'queueEmpty') return;
            this.emit(event, data);
        });
    }

    updateQueue(options) {
        super.updateQueue(options);
        this.tt.updateQueue(options);
    }

    enqueue(task) {
        return super.enqueue(_ => {
            return this.tt.enqueue(task)
        })
    }
}


/**
 * PullThrottler class
 *
 * Pulls tasks for execution and controls throughput using a FullThrottler
 */
class PullThrottler extends FullThrottler {
    constructor(options) {
        super(options);
        let {fetcher, failDelay = 1000} = options;

        this.fetcher = fetcher;

        this.tt.on('queueEmpty', () => {
            this.pull();
        });

        setInterval(() => {
            if (this.maxSimultaneous - this.simultaneous) {
                this.pull(this.maxSimultaneous - this.simultaneous);
            }
        }, failDelay);
    }

    pull(count = 1) {
        return this.fetcher(count)
            .then(
                tasks => {
                    tasks.forEach(task => {
                        this.enqueue(task)
                            .catch(() => {
                            });
                    })
                })
            .catch(() => {
            })
    }
}

exports.Queue = Queue;
exports.TokenThrottler = TokenThrottler;
exports.Throttler = Throttler;
exports.FullThrottler = FullThrottler;
exports.PullThrottler = PullThrottler;