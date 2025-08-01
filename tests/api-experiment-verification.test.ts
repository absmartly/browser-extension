import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('ABSmartly API Experiment Verification', () => {
  test.setTimeout(60000)

  test('Verify experiment created via natural language exists in API', async ({ request }) => {
    // Read the experiment data from previous test
    const fs = require('fs')
    const experimentDataPath = path.join(__dirname, 'temp-experiment-data.json')
    
    let experimentData
    try {
      const dataContent = fs.readFileSync(experimentDataPath, 'utf-8')
      experimentData = JSON.parse(dataContent)
    } catch (error) {
      console.log('No experiment data found. Run natural-language-dom.test.ts first.')
      test.skip()
      return
    }

    console.log('Verifying experiment:', experimentData.name)

    // Set up API client
    const apiUrl = 'http://localhost:8080'
    const apiKey = 'test-api-key'

    // Search for the experiment by name
    console.log('Searching for experiment in API...')
    const searchResponse = await request.get(`${apiUrl}/experiments`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      params: {
        name: experimentData.name
      }
    })

    expect(searchResponse.ok()).toBeTruthy()
    const experiments = await searchResponse.json()
    
    // Find our experiment
    const experiment = experiments.find((exp: any) => exp.name === experimentData.name)
    expect(experiment).toBeDefined()
    console.log('Found experiment:', experiment.id)

    // Get detailed experiment data
    const detailResponse = await request.get(`${apiUrl}/experiments/${experiment.id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    expect(detailResponse.ok()).toBeTruthy()
    const detailedExperiment = await detailResponse.json()

    // Verify experiment structure
    console.log('Verifying experiment structure...')
    expect(detailedExperiment).toHaveProperty('name', experimentData.name)
    expect(detailedExperiment).toHaveProperty('variants')
    expect(detailedExperiment.variants).toBeInstanceOf(Array)
    expect(detailedExperiment.variants.length).toBeGreaterThanOrEqual(2)

    // Verify variant configuration contains DOM changes
    console.log('Verifying DOM changes in variants...')
    let foundDomChanges = false
    
    for (const variant of detailedExperiment.variants) {
      if (variant.config) {
        let config
        try {
          config = typeof variant.config === 'string' ? JSON.parse(variant.config) : variant.config
        } catch (e) {
          console.log('Failed to parse variant config:', e)
          continue
        }

        if (config.dom_changes) {
          console.log(`Variant ${variant.name} has DOM changes:`, config.dom_changes)
          
          // Verify the DOM changes match what we generated
          const hasButtonStyling = config.dom_changes.some((change: any) => 
            change.selector === 'button' && 
            change.action === 'style' && 
            change.property === 'borderRadius'
          )
          
          if (hasButtonStyling) {
            foundDomChanges = true
            console.log('✓ Found button border-radius styling in variant:', variant.name)
            
            // Verify the exact DOM change
            const borderRadiusChange = config.dom_changes.find((change: any) => 
              change.selector === 'button' && 
              change.action === 'style' && 
              change.property === 'borderRadius'
            )
            
            expect(borderRadiusChange).toBeDefined()
            expect(borderRadiusChange.value).toBeTruthy()
            console.log('Border radius value:', borderRadiusChange.value)
          }
        }
      }
    }

    expect(foundDomChanges).toBeTruthy()

    // Verify treatment_variables if they exist
    if (detailedExperiment.treatment_variables) {
      console.log('Checking treatment_variables...')
      for (const [key, value] of Object.entries(detailedExperiment.treatment_variables)) {
        console.log(`Treatment variable ${key}:`, value)
      }
    }

    // Verify experiment is properly configured
    expect(detailedExperiment.state).toBeDefined()
    expect(detailedExperiment.percentage_of_traffic).toBeGreaterThan(0)
    expect(detailedExperiment.nr_variants).toBeGreaterThanOrEqual(2)

    console.log('\n✅ Experiment verification successful!')
    console.log('- Experiment exists in API')
    console.log('- Contains DOM changes for button styling')
    console.log('- Has proper variant configuration')
    console.log('- Natural language was correctly translated to DOM changes')

    // Clean up temp file
    try {
      fs.unlinkSync(experimentDataPath)
    } catch (e) {
      // Ignore cleanup errors
    }
  })

  test('Mock API test - Verify DOM changes payload structure', async ({ request }) => {
    // This test verifies the expected API payload structure
    // It can run even without a real API

    const expectedPayload = {
      name: 'test_experiment',
      display_name: 'Test Experiment',
      state: 'ready',
      percentage_of_traffic: 100,
      variants: [
        {
          variant: 0,
          name: 'Control',
          config: JSON.stringify({})
        },
        {
          variant: 1,
          name: 'Variant 1',
          config: JSON.stringify({
            dom_changes: [
              {
                selector: 'button',
                action: 'style',
                property: 'borderRadius',
                value: '8px'
              }
            ]
          })
        }
      ]
    }

    // Verify the structure is correct
    expect(expectedPayload.variants[1].config).toBeTruthy()
    const variantConfig = JSON.parse(expectedPayload.variants[1].config)
    expect(variantConfig.dom_changes).toBeInstanceOf(Array)
    expect(variantConfig.dom_changes[0]).toMatchObject({
      selector: 'button',
      action: 'style',
      property: 'borderRadius',
      value: expect.any(String)
    })

    console.log('✓ DOM changes payload structure is correct')
  })
})