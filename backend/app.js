const Koa = require('koa')
const bodyParser = require('koa-bodyparser')
const koaStatic = require('koa-static')

const {
  getAuthenticatedUser,
  handleRead,
  handleCreate,
  handleUpdate,
  handleDelete
} = require('./operations')

const {
  connectDb,
} = require('./db')

const { getSchemaForTable, updateSchemaForTable } = require('./schema')

const app = new Koa()
app.use(bodyParser({enableTypes: ['text', 'json']}))
app.use(koaStatic('./frontend/'));

const { types } = require('./solnet/config')

const init = async () => {
  const pool = connectDb()

  // TODO: ONLY IF NODE_ENV=development
  for (let key in types) {
    await updateSchemaForTable(pool, types[key])
  }
//  getSchemaForTable(pool, 'users')

  app.use(async ctx => {
    if (ctx.request.href.indexOf('data') !== -1) {
      const request = ctx.request.body
      let user

      if (ctx.request.headers['x-token']) {
        user = await getAuthenticatedUser(pool, ctx.request.headers['x-token'])
      }

      const response = {
        body: {}
      }

      if (user) {
        response.body.currentUser = user
      }

      console.log('request: ', request)

      if (request.action && request.method) {
        switch (request.method) {
          case 'create':
            await handleCreate({ pool, types, user, request, response })
            break
          case 'delete':
            await handleDelete({ pool, types, user, request, response })
            break
          case 'update':
            await handleUpdate({ pool, types, user, request, response })
            break
        }
      } else {
        await handleRead({ pool, types, user, request, response })
      }

      if (response.headers) {
        for (let key in response.headers) {
          ctx.set(key, response.headers[key])
        }
      }
      ctx.body = response.body
    }
  })

  app.listen(3000)
}

init()
