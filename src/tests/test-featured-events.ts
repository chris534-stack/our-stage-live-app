/**
 * Test script to verify that getFeaturedEventsFirestore correctly filters out past events
 * 
 * Run this with: npx tsx src/tests/test-featured-events.ts
 */

import { getFeaturedEventsFirestore } from '../lib/data';

async function testFeaturedEvents() {
    console.log('Testing getFeaturedEventsFirestore...\n');
    console.log('Current date:', new Date().toISOString());
    console.log('Expected: Only events from today onwards should be returned\n');

    try {
        const events = await getFeaturedEventsFirestore(10);

        console.log(`\nFound ${events.length} featured events:\n`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        events.forEach((event, index) => {
            const firstOccurrence = event.occurrences?.[0];
            if (firstOccurrence) {
                const eventDate = new Date(firstOccurrence.date);
                const isPast = eventDate < today;
                const status = isPast ? '❌ PAST EVENT (BUG!)' : '✅ Future/Today';

                console.log(`${index + 1}. ${event.title}`);
                console.log(`   Date: ${firstOccurrence.date} ${firstOccurrence.time || ''}`);
                console.log(`   Status: ${status}\n`);
            }
        });

        // Check if any past events were included
        const pastEvents = events.filter(event => {
            const firstOccurrence = event.occurrences?.[0];
            if (!firstOccurrence) return false;
            const eventDate = new Date(firstOccurrence.date);
            return eventDate < today;
        });

        if (pastEvents.length > 0) {
            console.log(`\n⚠️  FAILED: Found ${pastEvents.length} past event(s) in the results!`);
            process.exit(1);
        } else {
            console.log('\n✅ SUCCESS: All featured events are from today or future dates!');
            process.exit(0);
        }

    } catch (error) {
        console.error('Error testing featured events:', error);
        process.exit(1);
    }
}

testFeaturedEvents();
