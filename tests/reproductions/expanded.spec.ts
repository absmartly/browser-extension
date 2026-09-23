import type { Route } from '@playwright/test'
import { test, expect } from './fixture'

const endpoint = 'https://fixture.absmartly.com'
const field = { id: 91, title: 'Fixture hypothesis', type: 'text', default_value: 'Owned hypothesis' }
const resources = {
  applications: [{ id: 1, application_id: 1, name: 'Fixture application' }],
  unit_types: [{ unit_type_id: 1, name: 'fixture_unit' }],
  metrics: [], metric_categories: [], experiment_tags: [], users: [], teams: [],
  experiments: [], favorites: [], environments: [], experiment_custom_section_fields: [field],
  user: { id: 1, user_id: 1, first_name: 'Synthetic', last_name: 'Fixture', email: 'fixture@example.invalid' }
}
const respond = (route: Route, data: unknown, status = 200) => route.fulfill({
  status, contentType: 'application/json', body: JSON.stringify(data)
})

for (const empty of [false, true]) {
  test(`definition ${empty ? 'empty-list success' : 'failure retains draft and retries'} through packaged editor`, async ({ page, sidebar }) => {
    let unavailable = !empty
    const creates: any[] = []
    await page.context().route(`${endpoint}/**`, async route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/v1/experiment_custom_section_fields') {
        return respond(route, unavailable ? {error: 'fixture failure'} : {experiment_custom_section_fields: empty ? [] : [field]}, unavailable ? 400 : 200)
      }
      if (path === '/v1/experiments' && route.request().method() === 'POST') {
        const data = route.request().postDataJSON()
        creates.push(data)
        return respond(route, {experiment: {...data, id: 101}})
      }
      return respond(route, resources)
    })
    await sidebar.locator('#configure-settings-button').click()
    await sidebar.locator('#absmartly-endpoint').fill(endpoint)
    await sidebar.locator('#auth-method-apikey').check()
    await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
    await sidebar.getByRole('button', {name:'Save Settings', exact:true}).click()
    await sidebar.locator('button[title="Create New Experiment"]').click()
    await sidebar.locator('#from-scratch-button').click()
    await sidebar.locator('#experiment-name-input').fill('ft_2244_owned_draft')
    await sidebar.locator('#unit-type-select-trigger').click()
    await sidebar.locator('#unit-type-select-dropdown').getByText('fixture_unit', {exact:true}).click()
    await sidebar.locator('#create-experiment-button').click()
    if (!empty) {
      await expect(sidebar.locator('[data-testid="experiment-save-status"]')).toHaveAttribute('data-step','error')
      expect(creates).toEqual([])
      await expect(sidebar.locator('#experiment-name-input')).toHaveValue('ft_2244_owned_draft')
      await expect(sidebar.locator('#create-experiment-button')).toBeEnabled()
      unavailable = false
      await sidebar.locator('#create-experiment-button').click()
    }
    await expect(sidebar.locator('#experiments-heading')).toBeVisible()
    expect(creates).toHaveLength(1)
    expect(creates[0].custom_section_field_values).toEqual(empty ? {} : {'91': {id:91,type:'text',value:'Owned hypothesis'}})
  })
}

test('malformed HTTP prefix is rejected without persisting it', async ({ sidebar }) => {
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill('http:/fixture.absmartly.com')
  await sidebar.getByRole('button', {name:'Save Settings',exact:true}).click()
  await expect(sidebar.getByText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.',{exact:true})).toBeVisible()
  await expect(sidebar.locator('#absmartly-endpoint')).toBeFocused()
  await expect(sidebar.locator('#nav-settings')).toHaveCount(0)
})

test('older reachability failure cannot replace current syntax feedback', async ({ page, sidebar }) => {
  let release!: () => Promise<void>
  await page.context().route(`${endpoint}/**`, route => {
    release = () => respond(route, {error:'fixture unavailable'},500)
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.getByRole('button', {name:'Save Settings',exact:true}).click()
  await expect.poll(() => !!release).toBe(true)
  await sidebar.locator('#absmartly-endpoint').fill('http://[')
  await sidebar.getByRole('button', {name:'Save Settings',exact:true}).click()
  await expect(sidebar.getByText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.',{exact:true})).toBeVisible()
  await release()
  // A message round trip drains the resolved background probe; an animation
  // frame then lets React commit any stale feedback that would overwrite it.
  await sidebar.locator('body').evaluate(async () => {
    await chrome.runtime.sendMessage({type:'GET_CONFIG'})
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
  await expect(sidebar.getByText('Invalid endpoint URL. Use a valid HTTP or HTTPS URL.',{exact:true})).toBeVisible()
})

test('real mention keyboard input ignores old query results and survives Escape/reopen', async ({ page, sidebar }) => {
  let releaseAlpha!: () => Promise<void>
  await page.context().route(`${endpoint}/**`, route => {
    const search = new URL(route.request().url()).searchParams.get('search')
    if (search === 'Alpha') {
      releaseAlpha = () => respond(route, {experiments:[{id:101,name:'alpha',display_name:'Fixture Alpha',type:'test'}],total:1})
      return
    }
    if (search === 'Beta') return respond(route, {experiments:[{id:102,name:'beta',display_name:'Fixture Beta',type:'test'}],total:1})
    return respond(route, {...resources,experiment_custom_section_fields:[{...field,default_value:''}]})
  })
  await sidebar.locator('#configure-settings-button').click()
  await sidebar.locator('#absmartly-endpoint').fill(endpoint)
  await sidebar.locator('#auth-method-apikey').check()
  await sidebar.locator('#api-key-input').fill('synthetic-not-a-secret')
  await sidebar.getByRole('button',{name:'Save Settings',exact:true}).click()
  await sidebar.locator('button[title="Create New Experiment"]').click()
  await sidebar.locator('#from-scratch-button').click()
  const editor = sidebar.locator('#cfe-input-91')
  await editor.fill('#Alpha')
  await expect.poll(() => !!releaseAlpha).toBe(true)
  await editor.fill('#Beta')
  await releaseAlpha()
  await expect(sidebar.getByRole('option').filter({hasText:'Fixture Alpha'})).toHaveCount(0)
  await expect(sidebar.getByRole('option').filter({hasText:'Fixture Beta'})).toBeVisible()
  await editor.press('Escape')
  await expect(sidebar.locator('li[role="option"]')).toHaveCount(0)
  // Lexical owns the selection. Playwright's contenteditable fill('') can
  // race selection reconciliation and delete only the last character.
  // Clear through the real keyboard path and verify the reopen precondition.
  await editor.press('ControlOrMeta+a')
  await editor.press('Backspace')
  await expect(editor).toHaveText('')
  await editor.pressSequentially('#Beta')
  await expect(editor).toHaveText('#Beta')
  await expect(sidebar.getByRole('option').filter({hasText:'Fixture Beta'})).toBeVisible()
  await editor.press('ArrowDown')
  await editor.press('Enter')
  await expect(editor).toContainText('Fixture Beta')
  await expect(editor).not.toContainText('Fixture Alpha')
})
