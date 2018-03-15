const _ = require('lodash')
const fs = require('fs')
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
//app.use(koaStatic('./frontend/'));
//app.use(koaStatic('./shared/'));

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
      let status

      if (request.action && request.method) {
        switch (request.method) {
          case 'create':
            status = await handleCreate({ pool, types, user, request, response })
            break
          case 'delete':
            status = await handleDelete({ pool, types, user, request, response })
            break
          case 'update':
            status = await handleUpdate({ pool, types, user, request, response })
            break
        }
      } else {
        status = await handleRead({ pool, types, user, request, response })
      }

      if (response.headers) {
        for (let key in response.headers) {
          ctx.set(key, response.headers[key])
        }
      }

      if (status) {
        ctx.status = status
      }

      ctx.body = response.body
    } else {
      const parts = ctx.request.path.split('/')
      const filename = _.last(parts)
      let file
      if (filename.indexOf('js') !== -1 || parts.length > 2) {
        file = fs.readFileSync(`./frontend${ctx.request.path}`, 'utf-8')
      } else {
        file = fs.readFileSync('./frontend/index.html', 'utf-8')
        const key = _.first(filename.split('.'))
        file = file.replace(`const _STARTUP_ = ''`, `const _STARTUP_ = '${key}'`)
      }
      // TODO: stream it somehow
      ctx.set('Content-type', 'text/html')
      ctx.body = file
    }
  })

  app.listen(3000)
}

init()
