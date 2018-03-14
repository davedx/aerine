/*
 * 'index' is default route
 */

const state = {}

const showView = async (name) => {
  const viewConfig = state.views[name]
  const modulePath = `./solnet/${name}.html`
  const html = await fetch(modulePath, {
    method: 'GET'
  }).then(function(response) {
    return response.text()
  }).then(function(text) {
    return text
  })
  state.view = document.createElement('div')
  state.view.innerHTML = html

  const templateTags = state.view.getElementsByTagName('template')
  const styleTags = state.view.getElementsByTagName('style')
  const templateTag = templateTags[0]
  const styleTag = styleTags.length > 0 ? styleTags[0] : null
  create({template: templateTag, style: styleTag, mount: 'app', name: name})

  // TODO: get history API working
  //history.pushState({}, '', `${name}.html`)
}

const createApp = (views) => {
  state.views = views
  console.log('views: ', state.views)
  for (let key in views) {
    if (key === 'index') {
      showView(key)
    }
  }
}

