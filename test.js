const test = require('tape')
const { query, createDatabase } = require('./index')

test('find a single match', (t) => {
    const db = [
        [1, 'name', 'Alice'],
        [2, 'name', 'Bob'],
        [3, 'name', 'Carol']
    ]

    const res = query(db, ({ id }) => [
        [id, 'name', 'Alice']
    ])

    const [{id}] = [...res]
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

    const res = query(db, ({ childID }) => [
        [1, 'father-of', childID]
    ])

    const ids = [...res].map((p) => p.childID).sort()
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

    const res = query(db, ({ parentID, childID, name }) => [
        [parentID, 'name', 'Adam'],
        [childID, 'name', name],
        [parentID, 'father-of', childID]
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})

test('build a database with tables', (t) => {
    const db = createDatabase({
        person: [
            { id: 1, name: 'Adam' },
            { id: 2, name: 'Cain' },
            { id: 3, name: 'Abel' }
        ],
        parentChild: [
            { id: 1, childID: 2 },
            { id: 1, childID: 3 }
        ]
    })

    const res = query(db, ({parentID, childID, name}) => [
        [parentID, 'person/name', 'Adam'],
        [childID, 'person/name', name],
        [parentID, 'parentChild/childID', childID]
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})

test('rules', (t) => {
    const male = (n) => [n, 'male']
    const female = (n) => [n, 'female']
    const parent = (child, parent) => [parent, 'parent-of', child]
    const father = (child, parent) => [parent, 'father-of', child]

    const db = [
        male('james1'),
        male('charles1'),
        male('charles2'),
        male('james2'),
        male('george1'),

        female('catherine'),
        female('elizabeth'),
        female('sophia'),

        parent('charles1', 'james1'),
        parent('elizabeth', 'james1'),
        parent('charles2', 'charles1'),
        parent('catherine', 'charles1'),
        parent('james2', 'charles1'),
        parent('sophia', 'elizabeth'),
        parent('george1', 'sophia'),

        ({ Child, Father }) => [
            father(Child, Father), // :-
            male(Father),
            parent(Child, Father)
        ]
    ]

    const res = query(db, ({ name }) => [
        father(name, 'charles1')
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['catherine', 'charles2', 'james2'])
    t.end()
})
