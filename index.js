'use strict'
const esprima = require('esprima')
const estraverse = require('estraverse')

function createsNewScope (node) {
  return node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'Program'
}

module.exports = (sourceCode) => {
  const ast = esprima.parse(sourceCode, {
    jsx: true,
    tolerant: true
  })
  const scopeChain = []
  let identifiers = []
  const undefinedIdentifiers = new Set()

  function enter (node, parent) {
    if (createsNewScope(node)) {
      scopeChain.push([])
    }
    if (node.type === 'VariableDeclarator') {
      const currentScope = scopeChain[scopeChain.length - 1]
      if (node.id.name) {
        currentScope.push(node.id.name)
      } else {
        const pushDesctructuredToScope = (properties) => {
          properties.forEach((prop) => {
            if (prop.value.name) {
              currentScope.push(prop.value.name)
            } else { // deeper into the destructuring object tree
              pushDesctructuredToScope(prop.value.properties)
            }
          })
        }
        pushDesctructuredToScope(node.id.properties)
      }
      if (node.id.type === 'ObjectPattern') {
        return estraverse.VisitorOption.Skip
      }
    }
    if (parent && parent.type === 'MemberExpression') {
      if (node.name && parent.object.name === node.name) {
        identifiers.push(node.name)
      }
    } else {
      if (node.type === 'Identifier') {
        if (parent.type !== 'VariableDeclarator') {
          if (parent.type === 'Property') {
            if (parent.key === node) {
              return
            }
          }
          identifiers.push(node.name)
        }
      }
    }
  }

  function leave (node) {
    if (createsNewScope(node)) {
      checkForLeaks(identifiers, scopeChain)
      scopeChain.pop()
      identifiers = []
    }
  }

  function isVarDefined (varname, scopeChain) {
    for (var i = 0; i < scopeChain.length; i++) {
      const scope = scopeChain[i]
      // console.log('scopeChain: ', scopeChain);
      if (scope.indexOf(varname) !== -1) {
        return true
      }
    }
    return false
  }

  function checkForLeaks (identifiers, scopeChain) {
    identifiers.forEach((identifier) => {
      if (!isVarDefined(identifier, scopeChain)) {
        undefinedIdentifiers.add(identifier)
      }
    })
  }

  estraverse.traverse(ast, {
    enter: enter,
    leave: leave
  })
  return Array.from(undefinedIdentifiers)
}
