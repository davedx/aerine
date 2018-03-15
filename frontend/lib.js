// TODO: get it working with React

// TODO: make this REST compatible: __references an extension of a standard REST query of the root object type
// this way we can have mobile and other clients... (not like Meteor)
async function http(body, { contentType, method }) {
  const token = sessionStorage.getItem('token')
  const headers = {
    'Content-Type': contentType || 'text/plain'
  }
  if (token) {
    headers['X-token'] = token
  }

  let status

  return await fetch('/data', {
    body: JSON.stringify(body),
    headers: new Headers(headers),
    method: method || 'POST'
  }).then(response => {

    status = response.status
    if (response.headers.has('x-token')) {
      const token = response.headers.get('x-token')
      if (token) {
        sessionStorage.setItem('token', token)
      } else {
        sessionStorage.removeItem('token')
      }
    }

    return response.json()
  }).then(json => {
    if (status !== 200) {
      throw json
    }
    return json
  })
}

const renderTemplate = (context) => {
  const { app, template, data, queries } = context

  const root = template.content.children[0].cloneNode(true)

  processNodes(root, data)

  while (app.firstChild) {
      app.removeChild(app.firstChild);
  }
  app.appendChild(root)

  findActionsInNodes(app, context)
}

async function create(config) {
  const template = config.template
  const queriesJson = template.getAttribute('data')
  const queries = JSON.parse(queriesJson)
  //console.log('template queries: ', json)

  // find references
  let references = []
  findReferencesInNodes(template, references)
  //console.log('references: ', references)

  let data = {}
  if (queries) {
    queries.__references = references
    data = await http(queries, { contentType: 'application/json' })
    console.log('data: ', data)
  }

  // put it in the dom
  const app = document.getElementById(config.mount)
  if (config.style) {
    injectStyles(config.name, config.style, document.head)
  }
  renderTemplate({ app, template, data, queries })
}