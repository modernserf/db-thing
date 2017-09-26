const test = require('tape')
const { run, createDB, r } = require('./index')

test('find a single match', (t) => {
    const db = createDB([
        [1, 'name', 'Alice'],
        [2, 'name', 'Bob'],
        [3, 'name', 'Carol']
    ])

    const res = run(db, ({ id }) => [
        [id, 'name', 'Alice']
    ])

    const [{id}] = [...res]
    t.equals(id, 1)
    t.end()
})

test('find multiple results', (t) => {
    const db = createDB([
        [1, 'name', 'Adam'],
        [2, 'name', 'Cain'],
        [3, 'name', 'Abel'],
        [1, 'father-of', 2],
        [1, 'father-of', 3]
    ])

    const res = run(db, ({ childID }) => [
        [1, 'father-of', childID]
    ])

    const ids = [...res].map((p) => p.childID).sort()
    t.deepEquals(ids, [2, 3])
    t.end()
})

test('find relationships', (t) => {
    const db = createDB([
        [1, 'name', 'Adam'],
        [2, 'name', 'Cain'],
        [3, 'name', 'Abel'],
        [1, 'father-of', 2],
        [1, 'father-of', 3]
    ])

    const res = run(db, ({ parentID, childID, name }) => [
        [parentID, 'name', 'Adam'],
        [childID, 'name', name],
        [parentID, 'father-of', childID]
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})

test('rules', (t) => {
    const db = createDB([
        r.gender('james1', 'male'),
        r.gender('charles1', 'male'),
        r.gender('charles2', 'male'),
        r.gender('james2', 'male'),
        r.gender('george1', 'male'),

        r.gender('catherine', 'female'),
        r.gender('elizabeth', 'female'),
        r.gender('sophia', 'female'),

        r.parent('charles1', 'james1'),
        r.parent('elizabeth', 'james1'),
        r.parent('charles2', 'charles1'),
        r.parent('catherine', 'charles1'),
        r.parent('james2', 'charles1'),
        r.parent('sophia', 'elizabeth'),
        r.parent('george1', 'sophia'),

        ({ Child, Father }) => [
            r.father(Child, Father), // :-
            r.gender(Father, 'male'),
            r.parent(Child, Father)
        ]
    ])

    const res = run(db, ({ name }) => [
        r.father(name, 'charles1')
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['catherine', 'charles2', 'james2'])
    t.end()
})

test('recursion', (t) => {
    const db = createDB([
        r.gender('james1', 'male'),
        r.gender('charles1', 'male'),
        r.gender('charles2', 'male'),
        r.gender('james2', 'male'),
        r.gender('george1', 'male'),

        r.gender('catherine', 'female'),
        r.gender('elizabeth', 'female'),
        r.gender('sophia', 'female'),

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
        ({ Descendant, Middle, Ancestor }) => [
            r.ancestor(Descendant, Ancestor),
            r.parent(Middle, Ancestor),
            r.ancestor(Descendant, Middle)
        ]
    ])

    const res = run(db, ({ name }) => [
        r.ancestor('charles2', name)
    ])

    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['charles1', 'james1'])
    t.end()
})
