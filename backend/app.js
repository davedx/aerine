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
  handleDelete,
  handleCustomMethod
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

const httpMap = {
  'get': 'read',
  'post': 'create',
  'put': 'update',
  'delete': 'delete'
}

const mapHttpMethod = (method) => {
  if (!httpMap[method]) {
    console.error(`Unsupported method: ${method}`)
    return ''
  } else {
    return httpMap[method]
  }
}

const singularize = (plural) => {
  if (_.last(plural) === 's') {
    return plural.slice(0, plural.length-1)
  }
  return plural
}

const mapUri = (uri) => {
  // TODO: use proper functions to refactor this horrible hacky function
  const lastPart = _.last(uri.split('/'))
  let action, params = {}
  if (lastPart.indexOf('?') !== -1) {
    const last = lastPart.split('?')
    action = _.first(last)
    const pairs = _.last(last).split('=')
    params[pairs[0]] = pairs[1]
  } else {
    action = lastPart
  }
  return [action, {
    [action]: {
      type: singularize(action),
      ...params
    }
  }]
}

const init = async () => {
  const pool = connectDb()

  // TODO: ONLY IF NODE_ENV=development
  for (let key in types) {
    await updateSchemaForTable(pool, types[key])
  }

  app.use(async ctx => {
    if (ctx.request.href.indexOf('data') !== -1) {
      let request
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

      let method

      // process uris
      const uri = _.last(ctx.request.href.split('data', 2))
      if (uri) {
        method = mapHttpMethod(ctx.request.method.toLowerCase())
        if (!method) {
          ctx.status = 400
          ctx.body = `Unsupported method. Only HTTP methods are allowed`
          return
        }
        let res = mapUri(uri)
        //console.log(res)
        request = res[1]
        //console.log(`REST request: ${method}`, request)
        // TODO: support nested resources
        // e.g. /posts/users -> return posts with users
      } else {
        request = ctx.request.body
        method = request.method || 'read'
      }

      console.log(`uri: ${uri}`)

      console.log(`Request: ${method}`, request)
      let status

      if (method) {
        switch (method) {
          case 'create':
            status = await handleCreate({ pool, types, user, request, response })
            break
          case 'delete':
            status = await handleDelete({ pool, types, user, request, response })
            break
          case 'update':
            status = await handleUpdate({ pool, types, user, request, response })
            break
          case 'read':
            status = await handleRead({ pool, types, user, request, response })
            break
          default:
            status = await handleCustomMethod({ pool, types, user, request, response })
            break
        }
      }

      if (response.headers) {
        for (let key in response.headers) {
          ctx.set(key, response.headers[key])
        }
      }

      if (status) {
        console.log('status: ', status)
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
      // TODO: stream it
      ctx.set('Content-type', 'text/html')
      ctx.body = file
    }
  })

  app.listen(3000)
}

init()
