const test = require('tape')
const { query, createDatabase, pull, r } = require('./index')

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
    const db = [
        r.male('james1'),
        r.male('charles1'),
        r.male('charles2'),
        r.male('james2'),
        r.male('george1'),

        r.female('catherine'),
        r.female('elizabeth'),
        r.female('sophia'),

        r.parent('charles1', 'james1'),
        r.parent('elizabeth', 'james1'),
        r.parent('charles2', 'charles1'),
        r.parent('catherine', 'charles1'),
        r.parent('james2', 'charles1'),
        r.parent('sophia', 'elizabeth'),
        r.parent('george1', 'sophia'),

        ({ Child, Father }) => [
            r.father(Child, Father), // :-
            r.male(Father),
            r.parent(Child, Father)
        ]
    ]

    const res = query(db, ({ name }) => [
        r.father(name, 'charles1')
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['catherine', 'charles2', 'james2'])
    t.end()
})

test('recursion', (t) => {
    const db = [
        r.male('james1'),
        r.male('charles1'),
        r.male('charles2'),
        r.male('james2'),
        r.male('george1'),

        r.female('catherine'),
        r.female('elizabeth'),
        r.female('sophia'),

        r.parent('charles1', 'james1'),
        r.parent('elizabeth', 'james1'),
        r.parent('charles2', 'charles1'),
        r.parent('catherine', 'charles1'),
        r.parent('james2', 'charles1'),
        r.parent('sophia', 'elizabeth'),
        r.parent('george1', 'sophia'),

        ({ Child, Parent }) => [
            r.ancestor(Child, Parent),
            r.parent(Child, Parent)
        ],
        ({ Child, Parent, Ancestor }) => [
            r.ancestor(Child, Ancestor),
            r.parent(Parent, Ancestor),
            r.ancestor(Child, Parent)
        ]
    ]

    const res = query(db, ({ name }) => [
        r.ancestor('charles2', name)
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['charles1', 'james1'])
    t.end()
})

test('pull', (t) => {
    const db = createDatabase({
        person: [
            { id: 1, name: 'James I', male: true },
            { id: 2, name: 'Charles I', male: true },
            { id: 3, name: 'Charles II', male: true },
            { id: 4, name: 'James II', male: true },
            { id: 5, name: 'George I', male: true },
            { id: 6, name: 'Catherine', female: true },
            { id: 7, name: 'Elizabeth', female: true },
            { id: 8, name: 'Sophia', female: true }
        ],
        parentChild: [
            { id: 1, childID: 2 },
            { id: 1, childID: 7 }
        ]
    })

    const res = pull(db, 1, ['person/name', {'parentChild/id': ['person/name']}])
    t.deepEquals(res, {
        'person/name': 'James I',
        'male': true,
        'parentChild/id': [{'person/name': 'Charles I'}, {'person/name': 'Elizabeth'}]
    })
    t.end()
})
