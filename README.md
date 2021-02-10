# .List example issue

How to reproduce:
- Fill a Database inside `env.config.js` file (I used MySQL DB).
- For easy visualization, use Postman, import the `POSTMAN-COLLECTION` into your Postman.
- Install dependencies and run the program.
- In Postman (or directly with REPL) call `rbac.getRoles` with params.

What's happening, when calling `rbac.getRoles` with params `permissions` with values `potato,tomato2`,

it will find 1 entry, then changing the call param to `potato,tomato`, it still receives one entry.

If the cache get's cleared and the call remade, then it will receive the 3 entries.


The entries are generated at `afterConnected` inside `rbac.service`.
