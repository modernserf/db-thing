const _value = Symbol('_value')
// const _rest = Symbol('_rest')

class DB {
    constructor (...data) {
        this.rules = [].concat(...data.map((d) => [...createRules(d)]))
    }
    * query (queryFunc) {
        const { query, vars } = buildQueryMap(queryFunc)
        for (const endState of this._run(query)) {
            const result = getResult(endState, vars)
            if (result) { yield result }
        }
    }
    insert (data) {
        const id = String(Date.now())
        this.rules.push(...createRules({ [id]: data }))
    }
    where (params) {
        const qf = (q) =>
            Object.entries(params).map(([key, value]) => [q.id, key, value])
        return [...this.query(qf)].map(r => r.id)
    }
    find (id, key, defaultValue = null) {
        const q = this.query(p => [[String(id), key, p.value]])
        const { value, done } = q.next()
        return done ? defaultValue : value.value
    }
    findAll (id, key) {
        const q = this.query(p => [[String(id), key, p.value]])
        return [...q].map(r => r.value)
    }
    pull (id, keys) {
        return keys.reduce((m, key) => {
            if (typeof key === 'object') {
                for (const [childRel, childKeys] of Object.entries(key)) {
                    const childIDs = this.findAll(id, childRel)
                    m[childRel] = childIDs.map(cid => this.pull(cid, childKeys))
                }
            } else if ((this.schema[key] || {}).many) {
                m[key] = this.findAll(id, key)
            } else {
                m[key] = this.find(id, key)
            }
            return m
        }, {})
    }
    * _run ([query, ...restQueries], state = {}) {
        for (let nextState of this._matchRules(query, state)) {
            this._log('match', query, nextState)
            if (restQueries.length) {
                yield * this._run(restQueries, nextState)
            } else {
                yield nextState
            }
        }
    }
    * _matchRules (query, state) {
        if (query.runQuery) {
            yield * query.runQuery(this, state)
        } else {
            for (let rule of this.rules) {
                yield * rule.run(this, query, state)
            }
        }
    }
    _log (...args) {
        if (this.trace) {
            console.log(...args)
        }
    }
}

function val (x) { return x[_value] || x }
function sym (x) { return typeof x === 'symbol' }
function set (state, k, v) { return Object.assign({}, state, { [k]: v }) }
function lookup (state, v) {
    if (sym(v) && state[v]) { return lookup(state, state[v]) }
    return v
}
function unify (state, lhs, rhs) {
    lhs = lookup(state, lhs)
    rhs = lookup(state, rhs)

    // literal equality
    if (lhs === rhs) { return state }
    // new binding
    if (sym(lhs)) { return set(state, lhs, rhs) }
    if (sym(rhs)) { return set(state, rhs, lhs) }
    // array
    if (Array.isArray(lhs) && Array.isArray(rhs) && lhs.length === rhs.length) {
        const [l, ..._lhs] = lhs
        const [r, ..._rhs] = rhs
        const nextState = unify(state, l, r)
        if (!nextState) { return null }

        if (_lhs.length) {
            return unify(nextState, _lhs, _rhs)
        } else {
            return nextState
        }
    }
    // mismatch
    return null
}
function getResult (state, vars) {
    if (!state) { return null }
    return Object.keys(vars).reduce((m, v) => {
        const val = lookup(state, vars[v])
        if (!sym(val)) { m[v] = val }
        return m
    }, {})
}
function createVarBuilder (name, sym) {
    function varBuilder (id, ...params) {
        const arr = [id, name, ...params]
        arr.if = function (...rules) {
            return [arr].concat(rules)
        }
        return arr
    }
    // varBuilder[Symbol.iterator] = function * () {
    //     yield { [_rest]: sym }
    // }
    varBuilder[_value] = sym
    return varBuilder
}
function buildQueryMap (queryFunc) {
    const vars = {}
    const q = new Proxy({}, {
        get: (target, name) => {
            if (!target[name]) {
                const sym = Symbol(name)
                target[name] = createVarBuilder(name, sym)
                vars[name] = sym
            }
            return target[name]
        }
    })

    const query = queryFunc(q).map((rule) =>
        Array.isArray(rule) ? rule.map((x) => val(x)) : rule)
    return { vars, query }
}
function createRule (fn) {
    const [head, ...body] = buildQueryMap(fn).query
    return {
        index: head,
        run: function * (db, query, state) {
            db._log('rule', head, state)
            const nextState = unify(state, head, query)
            if (nextState) { yield * db._run(body, nextState) }
        }
    }
}
function createFact (fact) {
    return {
        index: fact,
        run: function * (db, query, state) {
            db._log('fact', fact, state)
            const nextState = unify(state, fact, query)
            if (nextState) { yield nextState }
        }
    }
}
function * createRules (data) {
    if (Array.isArray(data)) {
        yield createFact(data)
    } else if (typeof data === 'function') {
        yield createRule(data)
    } else {
        for (const [id, entry] of Object.entries(data)) {
            for (const [key, value] of Object.entries(entry)) {
                if (Array.isArray(value)) {
                    yield * value.map((v) => createFact([id, key, v]))
                } else {
                    yield createFact([id, key, value])
                }
            }
        }
    }
}

DB.assert = function (...vars) {
    const f = vars.pop()
    return {
        runQuery: function * (self, state) {
            self._log('runQuery', vars)
            const args = vars.map((v) => {
                const value = lookup(state, val(v))
                if (sym(value)) {
                    throw new Error('Arguments to `DB.assert` must be fully instantiated')
                }
                return value
            })
            if (f(...args)) { yield state }
        }
    }
}

module.exports = DB
