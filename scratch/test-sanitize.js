const { sanitize } = require('./src/lib/utils');

const mockTimestamp = {
    toDate: () => new Date('2026-04-24T12:00:00Z')
};

const data = {
    user: {
        name: 'Test',
        created: mockTimestamp,
        tags: ['a', 'b'],
        meta: Object.create(null)
    },
    list: [mockTimestamp, new Date()]
};

console.log('Original Prototype:', Object.getPrototypeOf(data.user.meta));
const sanitized = sanitize(data);
console.log('Sanitized:', JSON.stringify(sanitized, null, 2));
console.log('Sanitized Meta Prototype:', Object.getPrototypeOf(sanitized.user.meta));
