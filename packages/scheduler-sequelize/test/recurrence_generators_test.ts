import moment, { Moment } from 'moment-timezone';
import { expect } from 'chai';
import sinon, { SinonSandbox, SinonFakeTimers } from 'sinon';
import { computeNextRun } from '../../scheduler-prisma/src/helpers';
import lunartick from 'lunartick-deprecated';

const MAX_SKEW_MILLI_SECONDS = 60 * 1000; // Max skew b/w comparative dates

// There are some limitations to using lunartick
// 1. It does not support interval with rules that are monthly and have an interval > 1 (e.g. FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=2)
// 2. It does not support fortnightly rules (e.g. FREQ=WEEKLY;BYDAY=TH;INTERVAL=2)
// 3. It does not support BYMONTHDAY=-1 (https://github.com/ordermentum/lunartick/blob/develop/src/iterator.js#L110 shifts the date by an extra month)
// 4. It does not support multiple values for BYDAY (e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR)
// 5. It does not support BYSETPOS parameter (e.g. FREQ=DAILY;BYHOUR=8,18;BYMINUTE=30,0;BYSETPOS=1,4)
// 6. It does not chronologically sort BY rules (e.g. Values will be different for FREQ=DAILY;BYHOUR=8,18;BYMINUTE=0,30 and FREQ=DAILY;BYHOUR=8,18;BYMINUTE=30,0 - Note the BYMINUTE prop) 
// 7. It does not support -ve BYDAY values (e.g. FREQ=MONTHLY;BYDAY=-2FR)


const generateLunartickRecurrence = (interval: string, timezone: string) => {
    if (!interval.includes('DTSTART')) {
        const rule = lunartick.parse(interval);
        rule.tzId = timezone;
        const rrule = new lunartick(rule);
        return rrule.getNext(new Date()).date.toISOString();
    } else {
        const [DTSTART, rrule] = interval.split('\nRRULE:');
        const rule = lunartick.parse(rrule);
        rule.tzId = timezone;
        rule.dtStart = moment(`${DTSTART.split(':')[1]}+11:00`).toISOString();
        return new lunartick(rule).getNext(new Date()).date.toISOString();
    }
};

const generateRRuleRecurrence = (interval: string, timezone: string) => {
    return computeNextRun(interval, { timezone });
};

describe('helpers', () => {
    let sandbox: SinonSandbox;
    let clock: SinonFakeTimers;

    beforeEach(() => {
        process.env.TZ = 'Australia/Sydney';
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        process.env.TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (clock) clock.restore();
        sandbox.restore();
    })

    describe('Rrule and lunartick create the same recurrence date with rules that do not have DTSTART', () => {
        it('17th of every other month', () => {
            const rule = 'FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=1';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('every Thursday', () => {
            const rule = 'FREQ=WEEKLY;BYDAY=TH;INTERVAL=1';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('every monday', () => {
            const rule = 'FREQ=WEEKLY;BYDAY=MO';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('daily at 08:30 and 18:00', () => {
            const rule = 'FREQ=DAILY;BYHOUR=8,18;BYMINUTE=0,30';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
    });

    describe('Rrule and lunartick create the same recurrence date with rules that have DTSTART', () => {
        it('17th of every other month', () => {
            const rule = 'DTSTART;TZID=Australia/Sydney:20240120T030000\nRRULE:FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=1;BYHOUR=16;BYMINUTE=0;BYSECOND=0';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('every Thursday', () => {
            const rule = 'DTSTART;TZID=Australia/Sydney:20240120T030000\nRRULE:FREQ=WEEKLY;BYDAY=TH;INTERVAL=1;BYHOUR=16;BYMINUTE=0;BYSECOND=0';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('every monday', () => {
            const rule = 'DTSTART;TZID=Australia/Sydney:20240120T030000\nRRULE:FREQ=WEEKLY;BYDAY=MO;BYHOUR=16;BYMINUTE=0;BYSECOND=0';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
        it('daily at 08:30 and 18:00', () => {
            const rule = 'DTSTART;TZID=Australia/Sydney:20240120T030000\nRRULE:FREQ=DAILY;BYHOUR=8,18;BYMINUTE=0,30;BYSECOND=0';
            clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
            const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
        });
    });

    describe('Rrule supported rules', () => {
        it('Every other thursday respecting start date', () => {
            const rule = 'DTSTART;TZID=Australia/Sydney:20240120T030000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TH';
            clock = sinon.useFakeTimers(new Date('2024-02-01T16:00:00Z').getTime());
            const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
            expect(rrule).to.eqls('2024-02-14T16:00:00.000Z');
        });
    });

    describe('Rrule and lunartick create the same recurrence date for rules with date crossing DST thresholds', () => {
        describe('DST ending', () => {
            it('17th of every other month', () => {
                const rule = 'FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=1;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-04-06T14:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('every Thursday', () => {
                const rule = 'FREQ=WEEKLY;BYDAY=TH;INTERVAL=1;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-04-06T14:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('every monday', () => {
                const rule = 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-04-06T14:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('daily at 08:30 and 18:00', () => {
                const rule = 'FREQ=DAILY;BYHOUR=8,18;BYMINUTE=0,30';
                clock = sinon.useFakeTimers(new Date('2024-04-06T14:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
        });
        describe('DST start', () => {
            it('17th of every other month', () => {
                const rule = 'FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=1;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-10-05T15:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('every Thursday', () => {
                const rule = 'FREQ=WEEKLY;BYDAY=TH;INTERVAL=1;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-10-05T15:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('every monday', () => {
                const rule = 'FREQ=WEEKLY;BYDAY=MO;BYHOUR=17';
                clock = sinon.useFakeTimers(new Date('2024-10-05T15:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
            it('daily at 08:30 and 18:00', () => {
                const rule = 'FREQ=DAILY;BYHOUR=8,18;BYMINUTE=0,30';
                clock = sinon.useFakeTimers(new Date('2024-10-05T15:00:00.000Z').getTime());
                const lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.lessThan(MAX_SKEW_MILLI_SECONDS);
            });
        });
    });

    describe('Lunartick and rrule differences', () => {
        [
            'FREQ=MONTHLY;BYMONTHDAY=17;INTERVAL=2',
            'FREQ=WEEKLY;BYDAY=TH;INTERVAL=2',
            'FREQ=WEEKLY;BYMONTHDAY=-1;INTERVAL=2',
            'FREQ=WEEKLY;BYDAY=MO,WE,FR',
            'FREQ=DAILY;BYHOUR=8,18;BYMINUTE=30,0;BYSETPOS=1,4',
            'FREQ=DAILY;BYHOUR=8,18;BYMINUTE=30,0',
            'FREQ=MONTHLY;BYDAY=-2FR',
        ].forEach(rule => {
            it(`Rule: ${rule}`, () => {
                clock = sinon.useFakeTimers(new Date('2024-01-24T16:00:00Z').getTime());
                let lunartick;
                try {
                    lunartick = generateLunartickRecurrence(rule, 'Australia/Sydney');
                } catch (e) {
                    lunartick = null;
                }
                const rrule = generateRRuleRecurrence(rule, 'Australia/Sydney');
                if (lunartick === null) expect(rrule).to.not.be.null;
                else expect(Math.abs(moment(lunartick).valueOf() - moment(rrule).valueOf())).to.be.greaterThan(MAX_SKEW_MILLI_SECONDS);
            });
        });
    });
});