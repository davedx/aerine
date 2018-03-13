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

  create({template: state.view.getElementsByTagName('template')[0], mount: 'app'})
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

