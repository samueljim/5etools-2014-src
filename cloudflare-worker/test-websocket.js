/**
 * WebSocket test script for 5etools Character Sync
 * Tests real-time broadcasting of character create/update/delete operations
 * 
 * Prerequisites:
 * - Deploy your worker first
 * - Set WORKER_URL environment variable
 * - Install ws package: npm install ws
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const WS_URL = WORKER_URL.replace('http', 'ws');

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
 * Helper to create a test user session
 */
async function createTestUser() {
    const testUser = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!'
    };

    // Register test user
    const registerResponse = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(testUser)
    });

    if (registerResponse.status !== 200) {
        throw new Error(`Failed to register test user: ${JSON.stringify(registerResponse.data)}`);
    }

    // Login to get session token
    const loginResponse = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            username: testUser.username,
            password: testUser.password
        })
    });

    if (loginResponse.status !== 200) {
        throw new Error(`Failed to login test user: ${JSON.stringify(loginResponse.data)}`);
    }

    return {
        ...testUser,
        sessionToken: loginResponse.data.sessionToken,
        userId: loginResponse.data.user.id
    };
}

/**
 * Test WebSocket broadcasting for character operations
 */
async function testWebSocketBroadcasting() {
    console.log('🚀 Starting WebSocket broadcast tests...\n');
    console.log(`Testing against: ${WORKER_URL}\n`);

    try {
        // Create test user with session token
        console.log('📋 Setting up test user...');
        const user = await createTestUser();
        console.log(`✅ Test user created: ${user.username}`);

        // Create WebSocket connection
        console.log('📋 Connecting to WebSocket...');
        const ws = new WebSocket(`${WS_URL}/?room=character-sync&userId=${user.userId}`);
        
        const receivedMessages = [];
        let wsConnected = false;

        // Set up WebSocket event handlers
        ws.on('open', () => {
            console.log('✅ WebSocket connected');
            wsConnected = true;
        });

        ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            console.log(`📨 Received WebSocket message: ${message.type}`);
            receivedMessages.push(message);
        });

        ws.on('error', (error) => {
            console.error('❌ WebSocket error:', error);
        });

        // Wait for WebSocket connection
        await new Promise(resolve => {
            const checkConnection = () => {
                if (wsConnected) {
                    resolve();
                } else {
                    setTimeout(checkConnection, 100);
                }
            };
            checkConnection();
        });

        // Wait a moment to ensure connection is stable
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log('\n📋 Test 1: Character Creation Broadcast');
        
        // Create a test character
        const testCharacter = {
            name: `TestWizard_${Date.now()}`,
            level: 1,
            class: 'Wizard',
            race: 'Human',
            hp: { max: 8, current: 8 },
            ac: [{ ac: 12, from: ['Unarmored'] }],
        };

        const characterSave = await apiRequest('/api/characters/save', {
            method: 'POST',
            headers: {
                'X-Session-Token': user.sessionToken
            },
            body: JSON.stringify({
                characterData: testCharacter
            })
        });

        console.log(`Character save response: ${characterSave.status}`);
        if (characterSave.status === 200) {
            console.log('✅ Character created successfully');
        } else {
            console.log('❌ Character creation failed:', characterSave.data);
        }

        // Wait for broadcast message
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for CHARACTER_CREATED broadcast
        const createMessage = receivedMessages.find(m => m.type === 'CHARACTER_CREATED');
        if (createMessage && createMessage.characterName === testCharacter.name) {
            console.log('✅ CHARACTER_CREATED broadcast received correctly');
        } else {
            console.log('❌ CHARACTER_CREATED broadcast not received or incorrect');
            console.log('Received messages:', receivedMessages.map(m => m.type));
        }

        const characterId = characterSave.data.characterId;

        console.log('\n📋 Test 2: Character Update Broadcast');
        
        // Update the character
        testCharacter.level = 2;
        testCharacter.hp.max = 16;
        
        const characterUpdate = await apiRequest('/api/characters/save', {
            method: 'POST',
            headers: {
                'X-Session-Token': user.sessionToken
            },
            body: JSON.stringify({
                characterData: testCharacter,
                characterId: characterId,
                isEdit: true
            })
        });

        console.log(`Character update response: ${characterUpdate.status}`);
        if (characterUpdate.status === 200) {
            console.log('✅ Character updated successfully');
        } else {
            console.log('❌ Character update failed:', characterUpdate.data);
        }

        // Wait for broadcast message
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for CHARACTER_UPDATED broadcast
        const updateMessage = receivedMessages.find(m => m.type === 'CHARACTER_UPDATED' && m.characterId === characterId);
        if (updateMessage && updateMessage.characterName === testCharacter.name) {
            console.log('✅ CHARACTER_UPDATED broadcast received correctly');
        } else {
            console.log('❌ CHARACTER_UPDATED broadcast not received or incorrect');
        }

        console.log('\n📋 Test 3: Character Delete Broadcast');
        
        // Delete the character
        const characterDelete = await apiRequest(`/api/characters/delete?id=${characterId}`, {
            method: 'DELETE',
            headers: {
                'X-Session-Token': user.sessionToken
            }
        });

        console.log(`Character delete response: ${characterDelete.status}`);
        if (characterDelete.status === 200) {
            console.log('✅ Character deleted successfully');
        } else {
            console.log('❌ Character deletion failed:', characterDelete.data);
        }

        // Wait for broadcast message
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for CHARACTER_DELETED broadcast
        const deleteMessage = receivedMessages.find(m => m.type === 'CHARACTER_DELETED' && m.characterId === characterId);
        if (deleteMessage && deleteMessage.characterName === testCharacter.name) {
            console.log('✅ CHARACTER_DELETED broadcast received correctly');
        } else {
            console.log('❌ CHARACTER_DELETED broadcast not received or incorrect');
        }

        // Close WebSocket
        ws.close();

        console.log('\n📊 WebSocket Test Summary');
        console.log(`Total messages received: ${receivedMessages.length}`);
        console.log('Message types:', receivedMessages.map(m => m.type).join(', '));
        
        const expectedMessages = ['CONNECTED', 'CHARACTER_CREATED', 'CHARACTER_UPDATED', 'CHARACTER_DELETED'];
        const hasAllExpected = expectedMessages.every(type => 
            receivedMessages.some(m => m.type === type)
        );

        if (hasAllExpected) {
            console.log('🎉 All WebSocket broadcast tests passed!');
        } else {
            console.log('⚠️  Some WebSocket broadcasts may be missing');
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    }
}

// Run tests
if (require.main === module) {
    testWebSocketBroadcasting().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = { testWebSocketBroadcasting };