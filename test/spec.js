/* eslint-env node, mocha */
const undeclared = require('../index')
const expect = require('chai').expect

describe('esprima-undeclared-identifiers', function () {
  it('should return empty array if no undeclared identifiers are in the source code', function () {
    expect(undeclared('var answer = 6 * 7;').length).to.equal(0)
  })

  it('should find undeclared identifiers', function () {
    const found = undeclared('answer = 6 * 7;')
    expect(found.length).to.equal(1)
    expect(found[0]).to.equal('answer')

    const found2 = undeclared(`for (i = 0; i < scopeChain.length; i++) {
    var scope = scopeChain[i]
      if (scope.indexOf(varname) !== -1) {
      }
    }`)
    expect(found2[0]).to.equal('i')
    expect(found2[1]).to.equal('scopeChain')
    expect(found2[2]).to.equal('varname')

    const found3 = undeclared('var a, b, c; d')
    expect(found3[0]).to.equal('d')
  })
})
