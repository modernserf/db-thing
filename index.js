function * query (db, fn) {
    const vars = Array(fn.length).fill(0).map((_, i) => Symbol(`var ${i}`))
    const where = fn(...vars)
    const bindings = {}
    yield * innerQuery(bindings, db, vars, where)
}

function * innerQuery (bindings, db, vars, where) {
    const [w, ...rest] = where
    for (const rule of db) {
        const nextBindings = getBindings(bindings, rule, w, vars)
        if (nextBindings) {
            if (rest.length) {
                // more rules to match
                yield * innerQuery(nextBindings, db, vars, rest)
            } else {
                // finished matching
                yield vars.map((v) => nextBindings[v])
            }
        }
    }
}

function getBindings (initBindings, rule, w, vars) {
    const bindings = Object.assign({}, initBindings)
    for (let i = 0; i < w.length; i++) {
        const whereVal = w[i]
        const ruleVal = rule[i]
        if (vars.includes(whereVal)) {
            // is binding
            if (bindings[whereVal] && bindings[whereVal] !== ruleVal) {
                // has existing value & doesnt match
                return null
            } else {
                // set initial value
                bindings[whereVal] = ruleVal
            }
        } else if (whereVal !== ruleVal) {
            // is literal, doesn't match
            return null
        }
    }
    return bindings
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

module.exports = {
    query,
    createDatabase
}
