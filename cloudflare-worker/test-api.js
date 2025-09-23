/**
 * Test script for the 5etools Character API
 * Run with: node test-api.js
 * 
 * Prerequisites:
 * - Deploy your worker first
 * - Set WORKER_URL environment variable
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

/**
 * Helper function to make API requests
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${WORKER_URL}${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    const data = await response.json();
    return { status: response.status, data };
}

/**
 * Test suite
 */
async function runTests() {
    console.log('🚀 Starting 5etools API tests...\n');
    console.log(`Testing against: ${WORKER_URL}\n`);

    let testsPassed = 0;
    let testsFailed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ ${message}`);
            testsPassed++;
        } else {
            console.log(`❌ ${message}`);
            testsFailed++;
        }
    }

    try {
        // Test 1: Worker health check
        console.log('📋 Test 1: Worker Health Check');
        const health = await apiRequest('');
        assert(health.status === 200, 'Worker responds with 200');
        assert(health.data.message === '5etools Character Sync & API Worker', 'Correct worker message');
        console.log('');

        // Test 2: Create a test source
        console.log('📋 Test 2: Source Management');
        const testSource = 'test-source-' + Date.now();
        const testPassword = 'test-password-123';

        const sourceCreate = await apiRequest('/api/sources/create', {
            method: 'POST',
            body: JSON.stringify({
                source: testSource,
                password: testPassword
            })
        });
        assert(sourceCreate.status === 200, 'Source created successfully');
        assert(sourceCreate.data.success === true, 'Source creation returns success');

        // Test 3: List sources
        const sourceList = await apiRequest('/api/sources/list');
        assert(sourceList.status === 200, 'Sources list endpoint works');
        assert(sourceList.data.sources.length > 0, 'At least one source exists');

        // Test 4: Validate source password
        const sourceValidate = await apiRequest('/api/sources/validate', {
            method: 'POST',
            body: JSON.stringify({
                source: testSource,
                password: testPassword
            })
        });
        assert(sourceValidate.status === 200, 'Password validation endpoint works');
        assert(sourceValidate.data.valid === true, 'Correct password validates');

        // Test 5: Validate wrong password
        const sourceValidateWrong = await apiRequest('/api/sources/validate', {
            method: 'POST',
            body: JSON.stringify({
                source: testSource,
                password: 'wrong-password'
            })
        });
        assert(sourceValidateWrong.data.valid === false, 'Wrong password fails validation');

        console.log('');

        // Test 6: Save a test character
        console.log('📋 Test 3: Character Management');
        const testCharacter = {
            name: 'Test Wizard',
            level: 1,
            class: 'Wizard',
            race: 'Human',
            source: testSource,
            hp: 8,
            ac: 12,
            stats: {
                str: 10,
                dex: 14,
                con: 12,
                int: 16,
                wis: 13,
                cha: 11
            }
        };

        const characterSave = await apiRequest('/api/characters/save', {
            method: 'POST',
            body: JSON.stringify({
                characterData: testCharacter,
                source: testSource,
                password: testPassword
            })
        });
        assert(characterSave.status === 200, 'Character saved successfully');
        assert(characterSave.data.success === true, 'Character save returns success');

        const characterId = characterSave.data.characterId;
        assert(characterId.includes(testSource), 'Character ID includes source');

        // Test 7: Get the character
        const characterGet = await apiRequest(`/api/characters/get?id=${characterId}`);
        assert(characterGet.status === 200, 'Character retrieved successfully');
        assert(characterGet.data.character.character[0].name === testCharacter.name, 'Retrieved character has correct name');

        // Test 8: List characters
        const characterList = await apiRequest('/api/characters/list');
        assert(characterList.status === 200, 'Character list endpoint works');
        assert(characterList.data.characters.length > 0, 'At least one character exists');

        const foundCharacter = characterList.data.characters.find(c => c.id === characterId);
        assert(foundCharacter !== undefined, 'Test character appears in list');

        // Test 9: Update the character
        testCharacter.level = 2;
        testCharacter.hp = 16;
        const characterUpdate = await apiRequest('/api/characters/save', {
            method: 'POST',
            body: JSON.stringify({
                characterData: testCharacter,
                source: testSource,
                password: testPassword,
                characterId: characterId,
                isEdit: true
            })
        });
        assert(characterUpdate.status === 200, 'Character updated successfully');
        assert(characterUpdate.data.wasUpdate === true, 'Update correctly identified');

        // Test 10: Delete the character
        const characterDelete = await apiRequest(`/api/characters/delete?id=${characterId}&password=${testPassword}`, {
            method: 'DELETE'
        });
        assert(characterDelete.status === 200, 'Character deleted successfully');

        // Test 11: Verify character is deleted
        const characterGetDeleted = await apiRequest(`/api/characters/get?id=${characterId}`);
        assert(characterGetDeleted.status === 404, 'Deleted character returns 404');

        console.log('');

        // Test 12: Migration endpoints (if available)
        console.log('📋 Test 4: Migration Endpoints');
        const migrationStatus = await apiRequest('/migrate/status');
        assert(migrationStatus.status === 200, 'Migration status endpoint works');
        console.log('');

        // Test 13: WebSocket info (can't test actual WebSocket in Node.js easily)
        console.log('📋 Test 5: WebSocket Information');
        assert(health.data.endpoints.websocket.includes('ws://'), 'WebSocket URL provided');

        console.log('');

    } catch (error) {
        console.log(`❌ Test failed with error: ${error.message}`);
        testsFailed++;
    }

    // Summary
    console.log('='.repeat(50));
    console.log('📊 Test Summary');
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);
    console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
    
    if (testsFailed === 0) {
        console.log('🎉 All tests passed! Your migration is working correctly.');
    } else {
        console.log('⚠️  Some tests failed. Please check the issues above.');
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
});