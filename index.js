'use strict';

var esprima = require('esprima');
var estraverse = require('estraverse');

function createsNewScope(node) {
  return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'Program';
}

module.exports = function (sourceCode) {
  var ast = esprima.parse(sourceCode, {
    jsx: true,
    tolerant: true
  });
  var scopeChain = [];
  var identifiers = [];
  var lastFoundIdentifier = null;
  var undefinedIdentifiers = new Set();

  function enter(node, parent) {
    // clear lastFoundIdentifier
    if (parent && parent.type !== 'MemberExpression') {
      lastFoundIdentifier = null;
    }

    if (createsNewScope(node)) {
      scopeChain.push([]);
    }
    if (node.type === 'VariableDeclarator') {
      var currentScope = scopeChain[scopeChain.length - 1];
      if (node.id.name) {
        currentScope.push(node.id.name);
      } else {
        var pushDesctructuredToScope = function pushDesctructuredToScope(properties) {
          properties.forEach(function (prop) {
            if (prop.value.name) {
              currentScope.push(prop.value.name);
            } else {
              // deeper into the destructuring object tree
              pushDesctructuredToScope(prop.value.properties);
            }
          });
        };
        pushDesctructuredToScope(node.id.properties);
      }
      if (node.id.type === 'ObjectPattern') {
        return estraverse.VisitorOption.Skip;
      }
    }
    if (parent && parent.type === 'MemberExpression') {
      if (parent.object && parent.object.name === lastFoundIdentifier || parent.object.object && parent.object.property.name === lastFoundIdentifier) {
        var lastConcat = identifiers[identifiers.length - 1];
        lastConcat += '.' + node.name;
        identifiers[identifiers.length - 1] = lastConcat;
        lastFoundIdentifier = node.name;
      }
      if (node.name && parent.object.name === node.name) {
        lastFoundIdentifier = node.name;
        identifiers.push(node.name);
      }
    } else {
      if (node.type === 'Identifier') {
        if (parent.type !== 'VariableDeclarator') {
          if (parent.type === 'Property') {
            if (parent.key === node) {
              return;
            }
          }
          identifiers.push(node.name);
        }
      }
    }
  }

  function leave(node) {
    if (node.type === 'CallExpression') {
      // prop.value.funcCall
      var lastId = identifiers[identifiers.length - 1];
      // prop.value
      identifiers[identifiers.length - 1] = lastId.split('.').slice(0, lastId.split(',').length - 2).join('.');
    }

    if (createsNewScope(node)) {
      checkForLeaks(identifiers, scopeChain);
      scopeChain.pop();
      identifiers = [];
    }
  }

  function isVarDefined(varname, scopeChain) {
    for (var i = 0; i < scopeChain.length; i++) {
      var scope = scopeChain[i];
      // console.log('scopeChain: ', scopeChain);
      if (scope.indexOf(varname) !== -1) {
        return true;
      }
    }
    return false;
  }

  function checkForLeaks(identifiers, scopeChain) {
    identifiers.forEach(function (identifier) {
      if (!isVarDefined(identifier, scopeChain)) {
        undefinedIdentifiers.add(identifier);
      }
    });
  }

  estraverse.traverse(ast, {
    enter: enter,
    leave: leave
  });
  return Array.from(undefinedIdentifiers);
};
