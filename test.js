const test = require('tape')
const { query } = require('./index')

test('find a single match', (t) => {
    const db = [
        [1, 'name', 'Alice'],
        [2, 'name', 'Bob'],
        [3, 'name', 'Carol']
    ]

    const res = query(db, (id) => [
        [id, 'name', 'Alice']
    ])

    const [[id]] = [...res]
    t.equals(id, 1)
    t.end()
})

test('find multiple results', (t) => {
    const db = [
        [1, 'name', 'Adam'],
        [2, 'name', 'Cain'],
        [3, 'name', 'Abel'],
        [1, 'father-of', 2],
        [1, 'father-of', 3]
    ]

    const res = query(db, (childID) => [
        [1, 'father-of', childID]
    ])

    const ids = [...res].map(([id]) => id).sort()
    t.deepEquals(ids, [2, 3])
    t.end()
})

test('find relationships', (t) => {
    const db = [
        [1, 'name', 'Adam'],
        [2, 'name', 'Cain'],
        [3, 'name', 'Abel'],
        [1, 'father-of', 2],
        [1, 'father-of', 3]
    ]

    const res = query(db, (parentID, childID, name) => [
        [parentID, 'name', 'Adam'],
        [childID, 'name', name],
        [1, 'father-of', childID]
    ])

    const names = [...res].map(([_, __, name]) => name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})
