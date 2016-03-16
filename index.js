'use strict'
const esprima = require('esprima')
const estraverse = require('estraverse')

function createsNewScope (node) {
  return node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'Program'
}

module.exports = (sourceCode) => {
  const ast = esprima.parse(sourceCode)
  const scopeChain = []
  let identifiers = []
  const undefinedIdentifiers = new Set()

  function enter (node, parent) {
    if (createsNewScope(node)) {
      scopeChain.push([])
    }
    if (node.type === 'VariableDeclarator') {
      var currentScope = scopeChain[scopeChain.length - 1]
      currentScope.push(node.id.name)
    }
    if (parent && parent.type === 'MemberExpression') {
      if (node.name && parent.object.name === node.name) {
        identifiers.push(node.name)
      }
    } else {
      if (node.type === 'Identifier') {
        identifiers.push(node.name)
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
      var scope = scopeChain[i]
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
