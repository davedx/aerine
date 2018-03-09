
const mergeContext = (context, data) => {
  return {
    app: context.app,
    template: context.template,
    data: data,
    queries: context.queries
  }
}

const formSubmitted = async (e, context) => {
  e.preventDefault()
//  console.log('form submitted: ', e)
  const attrs = e.target.attributes
  console.log(attrs)
  const method = attrs['method'].value
  const action = attrs['action'].value
  const onSuccessUrl = attrs['onsuccessurl']
  const elements = e.target.elements
  console.log('form: '+method+' -> '+action)
  let update = {}
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    if (['text', 'textarea', 'password'].includes(el.type)) {
      update[el.name] = el.value
    }
  }
  console.log(update)
  const response = await http({
    action,
    method,
    update,
    queries: context.queries
//    __references: context.references
  }, { contentType: 'application/json' })
  console.log(response)
  if (response.event) {
    onEvent(response)
  }

  if (response.status === 'OK') {
    //const onSuccessUrl = e.target.attributes['onsuccessurl']
    console.log(onSuccessUrl)
    if (onSuccessUrl) {
      window.location = onSuccessUrl.value + '.html'
//      console.log('navigate to: ', onSuccessUrl.value)
    }
  }

  const newContext = mergeContext(context, response)
  
  renderTemplate(newContext)
}

const deleteClicked = async (e, id, context) => {
  const action = e.target.attributes['action'].value
  console.log('deleteClicked: ', id)
  const response = await http({
    action,
    method: 'delete',
    id,
    queries: context.queries
  }, { contentType: 'application/json' })
  console.log(response)

  const newContext = mergeContext(context, response)
  
  renderTemplate(newContext)
}

const findActionsInNodes = (node, context) => {
  const attrs = node.attributes
  if (attrs['t-id']) {
    context.__lastId = attrs['t-id'].value
  } else if (attrs['type'] && attrs['type'].value === 'delete') {
    const id = context.__lastId
    node.addEventListener('click', (e) => deleteClicked(e, id, context), false)
  } else if (attrs['method']) {
    const method = attrs['method'].value
    const action = attrs['action'].value
    if (['create', 'update', 'delete'].includes(method)) {
      console.log('form: ', method, action)
      node.addEventListener('submit', (e) => formSubmitted(e, context), false)
    }
//    findReferencesInFor(node, node.getAttribute('t-for'), refs)
  }
  const children = node.content ? node.content.children : node.children
  for (let i = 0; i < children.length; i++) {
    findActionsInNodes(children[i], context)
  }
}