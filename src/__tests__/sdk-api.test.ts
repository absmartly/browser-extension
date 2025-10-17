import * as ABSmartly from '@absmartly/javascript-sdk'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.dev.local') })

describe('ABsmartly SDK API Connection', () => {
  const apiEndpoint = process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo.absmartly.io'
  const apiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-dev-key'

  let sdk: any
  let context: any

  beforeAll(() => {
    console.log('\n🔧 SDK Configuration:')
    console.log('API Endpoint:', apiEndpoint)
    console.log('API Key:', apiKey.substring(0, 10) + '...')
  })

  afterEach(async () => {
    if (context) {
      try {
        await context.close()
      } catch (e) {
        // Ignore close errors
      }
      context = null
    }
  })

  test('should create SDK instance', () => {
    const sdkConfig = {
      endpoint: `${apiEndpoint}/v1`,
      apiKey: apiKey,
      environment: 'development',
      application: 'absmartly.com'
    }

    sdk = new ABSmartly.SDK(sdkConfig)
    expect(sdk).toBeDefined()
    console.log('✅ SDK instance created')
  })

  test('should create context and check experiments', async () => {
    const sdkConfig = {
      endpoint: `${apiEndpoint}/v1`,
      apiKey: apiKey,
      environment: 'development',
      application: 'absmartly.com'
    }

    sdk = new ABSmartly.SDK(sdkConfig)

    const contextConfig = {
      units: {
        session_id: `test-session-${Date.now()}`,
        user_id: 'test-user-123'
      }
    }

    try {
      context = await sdk.createContext(contextConfig)
      console.log('✅ Context created successfully')

      // Check if context has data
      const hasData = !!context.data
      console.log('Has data:', hasData)

      if (context.data) {
        const experimentCount = context.data.experiments?.length || 0
        console.log('Experiments available:', experimentCount)

        if (experimentCount > 0) {
          console.log('\n🧪 Available Experiments:')
          context.data.experiments.forEach((exp: any, index: number) => {
            console.log(`  ${index + 1}. ${exp.name} (ID: ${exp.id})`)
          })
        }
      }

      expect(context).toBeDefined()
    } catch (error: any) {
      console.error('❌ Context creation failed:', error.message)
      console.error('This likely means the API credentials are invalid')
      throw error
    }
  }, 10000)

  test('should test SDK event methods', async () => {
    const eventsFired: Array<{name: string, data: any}> = []
    
    const sdkConfig = {
      endpoint: `${apiEndpoint}/v1`,
      apiKey: apiKey,
      environment: 'development',
      application: 'absmartly.com',
      eventLogger: (context: any, eventName: string, data: any) => {
        console.log(`📡 Event fired: ${eventName}`)
        eventsFired.push({ name: eventName, data })
      }
    }

    sdk = new ABSmartly.SDK(sdkConfig)

    const contextConfig = {
      units: {
        session_id: `test-session-${Date.now()}`,
        user_id: 'test-user-123'
      }
    }

    try {
      context = await sdk.createContext(contextConfig)
      
      // Wait for ready state
      await context.ready()

      console.log('\n🧪 Testing SDK Methods:\n')
      console.log('Events captured so far:', eventsFired.map(e => e.name))

      // Test ready event (fired on context creation)
      console.log('1. Testing ready event (context creation)...')
      expect(eventsFired.some(e => e.name === 'ready')).toBe(true)

      // Test goal/track event
      console.log('2. Testing goal event (track)...')
      context.track('test_goal', { value: 100 })
      expect(eventsFired.some(e => e.name === 'goal')).toBe(true)

      // Test exposure event
      console.log('3. Testing exposure event (treatment)...')
      context.treatment('test_experiment')
      // Exposure might not fire if no experiment exists

      // Test refresh
      console.log('4. Testing refresh event...')
      try {
        await context.refresh()
        console.log('   ✅ Refresh succeeded')
      } catch (e: any) {
        console.log('   ⚠️  Refresh failed:', e.message)
      }

      // Test publish
      console.log('5. Testing publish event...')
      try {
        await context.publish()
        console.log('   ✅ Publish succeeded')
      } catch (e: any) {
        console.log('   ⚠️  Publish failed:', e.message)
      }

      // Test finalize/close
      console.log('6. Testing finalize event (close)...')
      try {
        await context.close()
        console.log('   ✅ Close succeeded')
      } catch (e: any) {
        console.log('   ⚠️  Close failed:', e.message)
      }

      console.log('\n📊 Events Summary:')
      console.log('Total events fired:', eventsFired.length)
      console.log('Event types:', [...new Set(eventsFired.map(e => e.name))].join(', '))

      const hasReady = eventsFired.some(e => e.name === 'ready')
      const hasGoal = eventsFired.some(e => e.name === 'goal')

      console.log('\n✅ At least ready and goal events work')
      expect(hasReady).toBe(true)
      expect(hasGoal).toBe(true)

      if (eventsFired.some(e => e.name === 'error')) {
        console.log('\n⚠️  Note: Error events detected. This is expected if API calls fail.')
        console.log('Error events will be fired for failed refresh/publish/close operations.')
      }

    } catch (error: any) {
      console.error('❌ Test failed:', error.message)
      throw error
    }
  }, 15000)
})
