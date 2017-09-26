const groupBy = require('lodash/groupBy')
const intersection = require('lodash/intersection')
const mapValues = require('lodash/mapValues')

const r = new Proxy({}, {
    get: (_, name) => (id, ...params) => [id, name, ...params]
})

const FREE_VAR = Symbol('FREE VAR')
const isFact = (x) => Array.isArray(x)
const isRule = (x) => typeof x === 'function'
const getGroup = (i) => (f) => sym(f.index[i]) ? FREE_VAR : f.index[i]

function createDB (rawRules) {
    const rules = rawRules.map((r) =>
        isFact(r) ? genFact(r)
            : isRule(r) ? genRule(r)
                : r)
    const indices = [
        groupBy(rules, getGroup(0)),
        groupBy(rules, getGroup(1)),
        groupBy(rules, getGroup(2))
    ]
    return { indices, rules }
}

function * run (db, rawQuery) {
    const initBindings = {}
    const { vars, query } = initQuery(rawQuery)
    for (const bindings of innerQuery(db, initBindings, query)) {
        yield mapVars(vars, bindings)
    }
}

function initQuery (rawQuery) {
    const vars = new Proxy({}, {
        get: (target, name) => {
            if (!target[name]) { target[name] = Symbol(name) }
            return target[name]
        }
    })
    const query = rawQuery(vars)
    return { vars, query }
}

function mapVars (vars, bindings) {
    return mapValues(vars, (symbol) => lookup(bindings, symbol))
}

function * innerQuery (db, bindings, [q, ...restQ]) {
    for (const rule of searchSpace(db, q)) {
        for (const nextBindings of rule.run(db, bindings, q)) {
            if (restQ.length) {
                yield * innerQuery(db, nextBindings, restQ)
            } else {
                yield nextBindings
            }
        }
    }
}

function genRule (ruleFn) {
    const vars = new Proxy({}, {
        get: (target, name) => {
            if (!target[name]) { target[name] = Symbol(name) }
            return target[name]
        }
    })

    const [head, ...body] = ruleFn(vars)
    function * runRule (db, oldBindings, q, rows) {
        const [row, ...restBody] = rows
        for (const rule of searchSpace(db, row)) {
            for (const nextBindings of rule.run(db, oldBindings, row)) {
                if (restBody.length) {
                    yield * runRule(db, nextBindings, q, restBody)
                } else {
                    yield nextBindings
                }
            }
        }
    }

    function * runOuter (db, bindings, q) {
        bindings = unify(bindings, q, head)
        if (bindings) { yield * runRule(db, bindings, q, body) }
    }

    return {
        index: head,
        run: runOuter
    }
}

function genFact (rdf) {
    return {
        index: rdf,
        run: function * (_, prevBindings, q) {
            const bindings = unify(prevBindings, q, rdf)
            if (bindings) { yield bindings }
        }
    }
}

function sym (v) { return typeof v === 'symbol' }
function set (l, k, v) { return Object.assign({}, l, { [k]: v }) }

// recursively trace bindings
function lookup (bindings, v) {
    if (!sym(v) || !bindings[v]) { return v }
    return lookup(bindings, bindings[v])
}

function unify (bindings, lhs, rhs) {
    lhs = lookup(bindings, lhs)
    rhs = lookup(bindings, rhs)

    // literal equality
    if (lhs === rhs) { return bindings }
    // new binding
    if (sym(lhs)) { return set(bindings, lhs, rhs) }
    if (sym(rhs)) { return set(bindings, rhs, lhs) }
    // array
    if (Array.isArray(lhs) && Array.isArray(rhs) && lhs.length === rhs.length) {
        for (let i = 0; i < lhs.length; i++) {
            bindings = unify(bindings, lhs[i], rhs[i])
            if (!bindings) { return null }
        }
        return bindings
    }

    // mismatch
    return null
}

function searchSpace (db, q) {
    const limits = []
    const ln = Math.min(q.length, db.indices.length)
    for (let i = 0; i < ln; i++) {
        if (!sym(q[i])) {
            const rows = db.indices[i][q[i]]
                .concat(db.indices[i][FREE_VAR] || [])
            limits.push(rows)
        }
    }
    if (!limits.length) { return db.rules }
    return intersection(...limits)
}

function logBindings (bindings) {
    console.log(Object.getOwnPropertySymbols(bindings)
        .map((k) => [k, bindings[k]]))
}

module.exports = { createDB, run, r, logBindings }
