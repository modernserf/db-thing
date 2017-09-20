function * query (db, rule) {
    const zzz = parseRule(rule)
    const bindings = {}
    yield * innerQuery(db, bindings, zzz)
}

function * innerQuery (db, bindings, zzz) {
    const matchingRules = db.filter((r) =>
        typeof r === 'function' || // all rules
        r[1] === zzz.head[1]) // fact with same name as the term

    for (const rule of matchingRules) {
        for (const nextBindings of getRuleBindings(db, bindings, zzz, rule)) {
            if (zzz.tail.length) {
                // more rules to match
                yield * innerQuery(db, nextBindings, nextZZZ(zzz))
            } else {
                // finished matching
                yield mapVars(zzz, nextBindings)
            }
        }
    }
}

function nextZZZ (zzz) {
    return Object.assign({}, zzz, { head: zzz.tail[0], tail: zzz.tail.slice(1) })
}

function parseRule (rule) {
    // simple fact
    if (Array.isArray(rule)) {
        return { head: rule, tail: [] }
    }

    // complex clause
    const vars = new Proxy({}, {
        get: (target, name) => {
            if (!target[name]) { target[name] = Symbol(name) }
            return target[name]
        }
    })

    const [head, ...tail] = rule(vars)
    return { vars, head, tail, popHead: (res) => rule(res)[0] }
}

function mapVars (zzz, bindings) {
    return Object.keys(zzz.vars).reduce((m, k) => {
        m[k] = lookup(bindings, zzz.vars[k])
        return m
    }, {})
}

function * getRuleBindings (db, initBindings, zzz, rule) {
    const parsedRule = parseRule(rule)
    let bindings = initBindings
    // if rule matches where pattern
    for (let i = 0; i < zzz.head.length; i++) {
        bindings = unify(bindings, zzz.head[i], parsedRule.head[i])
        if (!bindings) { return }
    }
    // simple fact
    if (!parsedRule.tail.length) {
        yield bindings
        return
    }

    for (const res of innerQuery(db, bindings, nextZZZ(parsedRule))) {
        yield * getRuleBindings(db, bindings, zzz, parsedRule.popHead(res))
    }
}

function sym (v) { return typeof v === 'symbol' }
function set (l, k, v) { return Object.assign({}, l, {[k]: v}) }

// recursively trace bindings
function lookup (bindings, v) {
    if (!bindings[v]) { return v }
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
    // mismatch
    return null
}

function createDatabase (tables) {
    const rules = []
    for (const tableName in tables) {
        const table = tables[tableName]
        for (const row of table) {
            const id = row.id
            if (!id) { throw new Error('Row must have `id` field') }
            for (const key in row) {
                if (key === 'id') { continue }
                rules.push([id, `${tableName}/${key}`, row[key]])
            }
        }
    }
    return rules
}

const r = new Proxy({}, {
    get: (_, name) => (id, ...params) => [id, name, ...params]
})

module.exports = {
    query,
    createDatabase,
    r
}
