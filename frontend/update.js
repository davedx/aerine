
const mergeContext = (context, data) => {
  return {
    app: context.app,
    template: context.template,
    data: data,
    queries: context.queries
  }
}

const maybeRedirect = (onSuccessUrl) => {
  if (onSuccessUrl) {
    showView(onSuccessUrl.value)
    return true
  }
  return false
}

const linkClicked = (e, context) => {
  e.preventDefault()
  const href = e.target.attributes['href'].value
  if (href.indexOf('http') !== 0) {
    // local URL: default use router
    const match = href.match(/([^/]+)\.html/)
    if (match) {
      const name = match[1]
      showView(name)
    }
  }
}

const getErrorElement = (el, errElId) => {
  // if no error div for element, make one
  let errEl = document.getElementById(errElId)
  if (!errEl) {
    errEl = document.createElement('div')
    errEl.id = errElId
    el.parentElement.appendChild(errEl)
  }
  return errEl
}

const formSubmitted = async (e, context) => {
  e.preventDefault()
//  console.log('form submitted: ', e)
  const attrs = e.target.attributes
  const method = attrs['method'].value
  const action = attrs['action'].value
  const onSuccessUrl = attrs['onsuccessurl']
  const elements = e.target.elements
  console.log('form: '+method+' -> '+action)
  let update = {}
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (['text', 'textarea', 'email', 'password', 'hidden'].includes(el.type)) {
      update[el.name] = el.value
    }
  }
  console.log(update)
  try {
    const response = await http({
      action,
      method,
      update,
      queries: context.queries
    }, { contentType: 'application/json' })
    console.log(response)

    if (maybeRedirect(onSuccessUrl)) {
      return
    }

    const newContext = mergeContext(context, response)
    renderTemplate(newContext)
  } catch (e) {
    console.error('error: ', e)

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i]
      const errElId = `${action}-${method}-${el.name}`
      const errEl = getErrorElement(el, errElId)

      if (e.error[el.name]) {
        console.log('found errs: ', e.error[el.name])
        const errorText = e.error[el.name].join(', ')
        errEl.innerHTML = errorText
      } else {
        errEl.innerHTML = ''
      }
    }
  }
}

const onClick = async (e, id, context) => {
  const attrs = e.target.attributes
  const action = attrs['action'].value
  const method = attrs['method'].value
  const onSuccessUrl = attrs['onsuccessurl']
  console.log('onClick: ', id)
  const response = await http({
    action,
    method: method,
    id,
    queries: context.queries
  }, { contentType: 'application/json' })
  console.log(response)

  if (maybeRedirect(onSuccessUrl)) {
    return
  }

  const newContext = mergeContext(context, response)
  
  renderTemplate(newContext)
}

const findActionsInNodes = (node, context) => {
  const attrs = node.attributes
  if (attrs['t-id']) {
    context.__lastId = attrs['t-id'].value
  } else if (node.nodeName === 'BUTTON' && attrs['method'] && attrs['action']) {
    const id = context.__lastId
    node.addEventListener('click', (e) => onClick(e, id, context), false)
  } else if (attrs['method']) {
    const method = attrs['method'].value
    const action = attrs['action'].value
    if (['create', 'update', 'delete'].includes(method)) {
      console.log('action found: ', method, action)
      node.addEventListener('submit', (e) => formSubmitted(e, context), false)
    }
//    findReferencesInFor(node, node.getAttribute('t-for'), refs)
  } else if (attrs['href']) {
    console.log('found hyperlink: ', node)
    node.addEventListener('click', (e) => linkClicked(e, context), false)
  }
  const children = node.content ? node.content.children : node.children
  for (let i = 0; i < children.length; i++) {
    findActionsInNodes(children[i], context)
  }
}