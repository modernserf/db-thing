const test = require('tape')
const DB = require('./index')

test('find in db', (t) => {
    const db = new DB({
        1: { name: 'Alice' },
        2: { name: 'Bob' },
        3: { name: 'Carol' }
    })
    t.equals(db.find(1, 'name'), 'Alice')
    t.equals(db.find('2', 'name'), 'Bob')
    t.equals(db.find(100, 'name'), null)
    t.end()
})

test('findAll', (t) => {
    const db = new DB({
        adam: {
            name: 'Adam',
            father_of: ['cain', 'abel']
        },
        cain: { name: 'Cain' },
        abel: { name: 'Abel' }
    })

    t.deepEquals(db.findAll('adam', 'father_of'), ['cain', 'abel'])
    t.end()
})

test('where', (t) => {
    const db = new DB({
        adam: {
            name: 'Adam',
            father_of: ['cain', 'abel']
        },
        cain: { name: 'Cain' },
        abel: { name: 'Abel' }
    })

    t.deepEquals(db.where({ father_of: 'cain' }), ['adam'])
    t.end()
})

test('pull', (t) => {
    const db = new DB({
        adam: {
            name: 'Adam',
            father_of: ['cain', 'abel']
        },
        cain: { name: 'Cain' },
        abel: { name: 'Abel' }
    })
    db.schema = {
        father_of: { many: true }
    }

    t.deepEquals(
        db.pull('adam', ['name', {father_of: ['name']}]),
        { name: 'Adam', father_of: [{name: 'Cain'}, {name: 'Abel'}] })
    t.end()
})

test('query, relationships', (t) => {
    const db = new DB({
        adam: {
            name: 'Adam',
            father_of: ['cain', 'abel']
        },
        cain: { name: 'Cain' },
        abel: { name: 'Abel' }
    })

    const res = db.query((q) => [
        [q.parentID, 'name', 'Adam'],
        [q.childID, 'name', q.name],
        [q.parentID, 'father_of', q.childID]
    ])
    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})

test('query, prolog syntax', (t) => {
    const db = new DB({
        adam: {
            name: 'Adam',
            father_of: ['cain', 'abel']
        },
        cain: { name: 'Cain' },
        abel: { name: 'Abel' }
    })

    const res = db.query((q) => [
        q.name(q.parentID, 'Adam'),
        q.name(q.childID, q.name),
        q.father_of(q.parentID, q.childID)
    ])
    const names = [...res].map((p) => p.name).sort()
    t.deepEquals(names, ['Abel', 'Cain'])
    t.end()
})

test('rules', (t) => {
    const db = new DB({
        james1: {
            gender: 'male',
            children: ['charles1', 'elizabeth']
        },
        charles1: {
            gender: 'male',
            children: ['charles2', 'catherine', 'james2']
        },
        elizabeth: {
            gender: 'female',
            children: ['sophia']
        },
        charles2: { gender: 'male' },
        catherine: { gender: 'female' },
        james2: { gender: 'male' },
        sophia: {
            gender: 'female',
            children: ['george1']
        },
        george1: { gender: 'male' }
    },
    (q) => q.father_of(q.father, q.child).if(
        q.gender(q.father, 'male'),
        q.children(q.father, q.child))
    )

    t.deepEquals(
        db.where({ father_of: 'charles1' }),
        ['james1'])
    t.end()
})

test('recursion', (t) => {
    const db = new DB({
        james1: {
            gender: 'male',
            children: ['charles1', 'elizabeth']
        },
        charles1: {
            gender: 'male',
            children: ['charles2', 'catherine', 'james2']
        },
        elizabeth: {
            gender: 'female',
            children: ['sophia']
        },
        charles2: { gender: 'male' },
        catherine: { gender: 'female' },
        james2: { gender: 'male' },
        sophia: {
            gender: 'female',
            children: ['george1']
        },
        george1: { gender: 'male' }
    },
    (q) => q.ancestor_of(q.parent, q.child).if(
        q.children(q.parent, q.child)),
    (q) => q.ancestor_of(q.ancestor, q.descendant).if(
        q.children(q.ancestor, q.middle),
        q.ancestor_of(q.middle, q.descendant))
    )

    t.deepEquals(
        db.where({ ancestor_of: 'charles2' }).sort(),
        ['charles1', 'james1'])
    t.end()
})

test('DB.eval', (t) => {
    const db = new DB({
        shirt1: { color: 'blue' },
        pants1: { color: 'red' },
        pants2: { color: 'blue' }
    },
    (q) => q.complements(q.a, q.b).if(
        q.color(q.a, q.a_color),
        q.color(q.b, q.b_color),
        DB.assert(q.a_color, q.b_color, (l, r) => l !== r)
    ))

    t.equals(db.find('shirt1', 'complements'), 'pants1')
    t.end()
})
