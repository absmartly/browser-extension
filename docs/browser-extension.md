I would like you to create a plan for a Browser Extension for ABsmartly where people can create experiments visually. It should be very similar to Statsig's Sidecar extension:
https://docs.statsig.com/guides/sidecar-experiments/introduction/
https://www.npmjs.com/package/statsig-sidecar

But with more features:
- allow users to apply dom changes by specifying which DOM element they would like to change and which rules to apply (like sidecar):
   what to change: text, html, style, attribute, class, javascript
- allow users to make changes using natural language (it should use ABsmartly's MCP server via Cloudflare https://blog.cloudflare.com/connect-any-react-application-to-an-mcp-server-in-three-lines-of-code/)


It should use ABsmartly variables to store the DOM changes (https://docs.absmartly.com/docs/sdk-documentation/advanced/code-as-a-variant-variable/, https://docs.absmartly.com/docs/SDK-Documentation/basic-usage#treatment-variables)

And then we should have a plugin for the ABsmartly SDK (https://github.com/absmartly/javascript-sdk) that loads the DOM changes for the variants the user should see and applies them.

Here's how we load the SDK in our site:
import { SDK } from "@absmartly/javascript-sdk";

const EXP_PREFIX = 'exp_';
const EXP_PREFIX_LENGTH = EXP_PREFIX.length;

interface Env {
  ABSMARTLY_API_KEY: string;
  ABSMARTLY_CONSOLE_API_KEY: string;
  ABSMARTLY_ENVIRONMENT: string;
  ABSMARTLY_APPLICATION: string;
  ABSMARTLY_UNIT_NAME: string;
  ABSMARTLY_ENDPOINT: string;
  ABSMARTLY_API_ENDPOINT: string;
}

interface Attributes {
  [key: string]: string;
}

interface ContextParams {
  units: {
    [key: string]: string;
  };
  attributes?: Attributes;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { searchParams } = new URL(request.url);
    let absId = searchParams.get("unit");
    const goalName = searchParams.get("goal");
    const initSDK = searchParams.get("init");

    // Parse incoming cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = parseCookies(cookieHeader);

    // If no unit is provided, use cookie or generate a new one
    if (!absId) {
      if (cookies.abs && cookies.abs !== "undefined" && cookies.abs.length > 0) {
        absId = cookies.abs;
      } else if (cookies.abs_public && cookies.abs_public !== "undefined") {
        absId = cookies.abs_public;
      } else {
        absId = generateFastUniqueID();
      }
    }

    // Handle goal tracking case
    if (goalName && !initSDK) {
      return await handleGoalTracking(absId, goalName, searchParams, env);
    }

    if (initSDK) {
      return await handleSDKInit(absId, searchParams, env);
    }

    return new Response('Invalid request. Must specify either init=1 or goal parameter', { status: 400 });
  },
};

async function handleGoalTracking(absId: string, goalName: string, searchParams: URLSearchParams, env: Env): Promise<Response> {
  const properties: Record<string, string> = {};
  const attributes: Array<{ name: string; value: string; setAt: number }> = [];

  searchParams.forEach((value, key) => {
    if (key !== "unit" && key !== "goal" && !key.startsWith("prop_")) {
      attributes.push({
        name: key,
        value: value,
        setAt: Date.now()
      });
    }
    if (key.startsWith("prop_")) {
      const propName = key.replace("prop_", "");
      properties[propName] = value;
    }
  });

  // Construct the request body for the ABSmartly context API
  const now = Date.now();
  const requestBody = {
    hashed: false,
    historic: false,
    publishedAt: now,
    units: [
      {
        type: env.ABSMARTLY_UNIT_NAME,
        uid: absId
      }
    ],
    goals: [
      {
        name: goalName,
        achievedAt: now,
        properties
      }
    ],
    attributes
  };

  // Make the PUT request to track the goal in ABSmartly
  const apiResponse = await fetch(`${env.ABSMARTLY_API_ENDPOINT}/context`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-Agent": "Cloudflare Worker SDK",
      "X-Environment": env.ABSMARTLY_ENVIRONMENT,
      "X-API-Key": env.ABSMARTLY_API_KEY
    },
    body: JSON.stringify(requestBody)
  });

  console.log("Goal tracking response status:", apiResponse.status);

  if (!apiResponse.ok) {
    const errorText = await apiResponse.text();
    console.error("Failed to track goal:", errorText);
    return apiResponse; 
  }

  return new Response('{}', { status: 200 });
}

async function handleSDKInit(absId: string, searchParams: URLSearchParams, env: Env): Promise<Response> {
  // Initialize SDK and get context data
  const serverSideData = await initializeSDK(absId, searchParams, env);
  
  // Generate response with necessary data
  const responseBody = `
    window.absId = "${absId}";
    window.serverSideData = ${JSON.stringify(serverSideData)};
    window.overriddenExperimentVariables = ${JSON.stringify(await getOverriddenVariables(searchParams, env))};
  `;

  // Set cookie headers
  const headers = new Headers({ 'Content-Type': 'text/javascript' });
  const expires = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toUTCString();
  
  headers.append(
    "Set-Cookie",
    `abs=${absId}; Expires=${expires}; Path=/; Domain=.absmartly.com; HttpOnly; SameSite=Lax`
  );
  headers.append(
    "Set-Cookie",
    `abs_public=${absId}; Expires=${expires}; Path=/; Domain=.absmartly.com; SameSite=Lax`
  );
  headers.append(
    "Set-Cookie",
    `abs_expiry=${Date.now()}; Expires=${expires}; Path=/; Domain=.absmartly.com; SameSite=Lax`
  );

  return new Response(responseBody, { status: 200, headers });
}

async function initializeSDK(absId: string, searchParams: URLSearchParams, env: Env) {
  const serverSideParams: ContextParams = {
    units: { absId },
    attributes: {},
  };

  // Extract additional attributes from query parameters
  const properties: Record<string, string> = {};
  const overrides: Record<string, string | number> = {};
  searchParams.forEach((value, key) => {
    if (
      key !== "init" &&
      key !== "unit" &&
      key !== "goal" &&
      !key.startsWith("prop_") &&
      !key.startsWith(EXP_PREFIX)
    ) {
      serverSideParams.attributes![key] = value;
    } else if (key.startsWith("prop_")) {
      const propName = key.replace("prop_", "");
      properties[propName] = value;
    } else if (key.startsWith(EXP_PREFIX)) {
      const expName = key.slice(EXP_PREFIX_LENGTH);
      overrides[expName] = isNaN(Number(value)) ? value : Number(value);
    }
  });

  // Create an SDK instance with the environment variables
  const sdk = new SDK({
    endpoint: env.ABSMARTLY_API_ENDPOINT,
    apiKey: env.ABSMARTLY_API_KEY,
    environment: env.ABSMARTLY_ENVIRONMENT,
    application: env.ABSMARTLY_APPLICATION,
    eventLogger: (context, eventName, data) => {
      console.log(eventName, data);
    },
  });

  // Create the server-side context with the SDK
  const serverSideContext = sdk.createContext(serverSideParams);

  // Apply overrides to the context
  if (Object.keys(overrides).length > 0) {
    serverSideContext.overrides(overrides);
  }

  await serverSideContext.ready();

  const goalName = searchParams.get("goal");
  if (goalName)
    serverSideContext.track(goalName, properties);

  return serverSideContext.data();
} 

async function getOverriddenVariables(searchParams: URLSearchParams, env: Env) {
  const overrides: Record<string, string | number> = {};
  const overriddenExperimentVariables: Record<string, any> = {};
  
  // Extract experiment overrides
  searchParams.forEach((value, key) => {
    if (key.startsWith("exp_")) {
      const expName = key.slice(4);
      overrides[expName] = isNaN(Number(value)) ? value : Number(value);
    }
  });

  if (Object.keys(overrides).length === 0) {
    return {};
  }

  // Define state priority
  const statePriority: Record<string, number> = {
    running: 1,
    scheduled: 2,
    development: 3,
    ready: 4,
    draft: 5,
    stopped: 6,
    archived: 7,
  };

  for (const [experimentName, variantValue] of Object.entries(overrides)) {
    try {
      const response = await fetch(
        `${env.ABSMARTLY_ENDPOINT}/v1/experiments?search=${encodeURIComponent(experimentName)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Api-Key ${env.ABSMARTLY_CONSOLE_API_KEY}`,
          },
        }
      );
      if (response.ok) {
        const { experiments } = await response.json() as { experiments: Array<{
          variants: any;
          name: string;
          state: string 
        }> };

        const matchingExperiments = experiments?.filter((exp: { name: string }) => exp.name === experimentName) || [];
        
        if (matchingExperiments.length > 0) {
          const experiment = matchingExperiments.sort((a: { state: string }, b: { state: string }) => 
            (statePriority[a.state] || 999) - (statePriority[b.state] || 999)
          )[0];

          const variantIndex = typeof variantValue === 'string'
          ? experiment.variants.findIndex(v => v.name === variantValue)
          : variantValue;

          // console.log("variantIndex", variantIndex);
          if (typeof variantIndex === 'number' && variantIndex >= 0) {
            const variant = experiment.variants[variantIndex];
            console.log("variant", variant);
            if (variant?.config) {
              try {
                // console.log("overriddenExperimentVariables", overriddenExperimentVariables);
                Object.assign(overriddenExperimentVariables, JSON.parse(variant.config));
                // console.log("overriddenExperimentVariables", overriddenExperimentVariables);
              } catch (e) {
                console.error("Failed to parse variant config:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching experiment ${experimentName}:`, error);
    }
  }

  return overriddenExperimentVariables;
}

// Helper function to parse cookies from the request header
function parseCookies(cookieHeader: string): { [key: string]: string } {
  return cookieHeader.split(";").reduce((cookies, cookie) => {
    const [name, value] = cookie.split("=").map(c => c.trim());
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as { [key: string]: string });
}

function generateFastUniqueID(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

Please come up with a plan and code examples on how to build this SDK plugin (especial attention on making it work in SPAs, even if the DOM elements that need changing are not visible in the page yet).

And with a plan on how to build the Browser Extension that allows users to create new experiments either via the ABsmartly API or via the MCP servers. Those experiments should have the DOM changes for each variant described in the variant variables passed to the experiment.

Here's The payload of one experiment returned by the API when we make a request to GET /v1/experiments:
    experiments:
      - id: 23736
        name: my_super_nice_experiment_1747324499388
        display_name: my_super_nice_experiment
        iteration: 2
        type: test
        state: running
        feature_state: null
        development_at: null
        start_at: 2025-05-15T15:56:57.928Z
        stop_at: null
        full_on_at: null
        full_on_variant: null
        feature_on_at: null
        feature_off_at: null
        last_seen_in_code_at: null
        nr_variants: 2
        percentages: 50/50
        percentage_of_traffic: 100
        seed: "38940540277116911"
        traffic_seed: "36839043071911909"
        created_at: 2025-05-15T15:56:57.331Z
        created_by_user_id: 3
        updated_at: null
        updated_by_user_id: null
        unit_type_id: 1
        primary_metric_id: 4
        audience: '{"filter":[{"and":[{"or":[{"eq":[{"var":{"path":"country"}},{"value":"gb"}]},{"eq":[{"var":{"path":"language"}},{"value":"en-GB"}]}]}]}]}'
        audience_strict: true
        minimum_detectable_effect: null
        archived: false
        analysis_type: group_sequential
        baseline_primary_metric_mean: "79"
        baseline_primary_metric_stdev: "30"
        baseline_participants_per_day: "1428"
        required_alpha: "0.1"
        required_power: "0.8"
        group_sequential_futility_type: binding
        group_sequential_analysis_count: null
        group_sequential_min_analysis_interval: 1d
        group_sequential_first_analysis_interval: 7d
        group_sequential_max_duration_interval: 4w
        template_iteration: null
        template_description: Updated the template with better images
        parent_experiment_id: 238
        parent_experiment_iteration: 2
        template_permission: null
        parent_experiment:
          updated_at: 2025-03-28T17:48:53.383Z
          archived: false
        applications:
          - experiment_id: 23736
            application_id: 1
            application_version: "0"
            application:
              id: 1
              name: www
              description: Desktop site
              created_at: 2023-07-13T12:01:19.418Z
              created_by_user_id: 2
              updated_at: 2025-04-03T17:47:27.906Z
              updated_by_user_id: 3
              archived: false
        unit_type:
          id: 1
          name: user_id
          description: User ID
          created_at: 2023-07-13T12:12:20.443Z
          created_by_user_id: 2
          updated_at: null
          updated_by_user_id: null
          archived: false
        primary_metric:
          id: 4
          goal_id: 2
          name: Checkouts
          description: User checkouts
          type: goal_count
          effect: positive
          archived: false
          impact_alert_threshold_upper: null
          impact_alert_threshold_lower: null
          format_str: "{}"
          scale: 1
          precision: 0
          mean_format_str: "{}"
          mean_scale: 1
          mean_precision: 4
          value_source_property: ""
          property_filter: '{"filter":{"and":[]}}'
          created_at: 2023-07-17T12:07:45.773Z
          created_by_user_id: 50
          updated_at: 2024-05-24T15:29:09.613Z
          updated_by_user_id: 3
          outlier_limit_method: unlimited
          outlier_limit_lower_arg: null
          outlier_limit_upper_arg: null
          numerator_type: null
          denominator_type: null
          denominator_value_source_property: null
          denominator_goal_id: null
          denominator_property_filter: null
          denominator_outlier_limit_method: null
          denominator_outlier_limit_lower_arg: null
          denominator_outlier_limit_upper_arg: null
          retention_time: null
          retention_time_reference: null
          denominator_retention_time: null
          denominator_retention_time_reference: null
          cancellation_foreign_goal_id: null
          cancellation_key_path: null
          cancellation_foreign_key_path: null
          relation_kind: null
          relation_foreign_goal_id: null
          relation_key_path: null
          relation_foreign_key_path: null
          relation_foreign_value_path: null
          relation_foreign_duplicate_operation: null
          relation_refund_operation: null
          denominator_cancellation_foreign_goal_id: null
          denominator_cancellation_key_path: null
          denominator_cancellation_foreign_key_path: null
          denominator_relation_kind: null
          denominator_relation_foreign_goal_id: null
          denominator_relation_key_path: null
          denominator_relation_foreign_key_path: null
          denominator_relation_foreign_value_path: null
          denominator_relation_foreign_duplicate_operation: null
          denominator_relation_refund_operation: null
          time_filter_earliest: null
          time_filter_latest: null
          denominator_time_filter_earliest: null
          denominator_time_filter_latest: null
          tags:
            - metric_id: 4
              metric_tag_id: 2
              metric_tag:
                id: 2
                tag: Business
                created_at: 2024-02-06T10:46:54.571Z
                created_by_user_id: 3
                updated_at: 2025-04-04T08:24:00.939Z
                updated_by_user_id: 3
          owners:
            - metric_id: 4
              user_id: 50
              user:
                id: 50
                external_id: null
                email: cal@absmartly.com
                first_name: Cal
                last_name: Courtney
                department: ""
                job_title: ""
                avatar_file_upload_id: null
                created_at: 2022-10-19T08:26:07.583Z
                created_by_user_id: 0
                updated_at: 2025-01-10T12:09:44.772Z
                updated_by_user_id: 50
                archived: false
                consecutive_login_failures: 0
                last_login_at: 2025-04-13T17:00:43.504Z
                last_login_failure_at: 2023-04-06T14:48:08.712Z
                demo_user: null
                avatar: null
          teams: []
        secondary_metrics:
          - experiment_id: 23736
            metric_id: 50
            type: secondary
            order_index: 0
            metric:
              id: 50
              goal_id: 2
              name: Checkout Nett Revenue
              description: Nett Revenue - AOV minus refunds
              type: goal_property
              effect: positive
              archived: false
              impact_alert_threshold_upper: null
              impact_alert_threshold_lower: null
              format_str: €{}
              scale: 1
              precision: 0
              mean_format_str: €{}
              mean_scale: 1
              mean_precision: 2
              value_source_property: amount
              property_filter: '{"filter":{"and":[]}}'
              created_at: 2024-05-23T14:36:25.031Z
              created_by_user_id: 3
              updated_at: 2024-05-24T15:38:03.956Z
              updated_by_user_id: 3
              outlier_limit_method: unlimited
              outlier_limit_lower_arg: null
              outlier_limit_upper_arg: null
              numerator_type: null
              denominator_type: null
              denominator_value_source_property: null
              denominator_goal_id: null
              denominator_property_filter: null
              denominator_outlier_limit_method: null
              denominator_outlier_limit_lower_arg: null
              denominator_outlier_limit_upper_arg: null
              retention_time: null
              retention_time_reference: null
              denominator_retention_time: null
              denominator_retention_time_reference: null
              cancellation_foreign_goal_id: null
              cancellation_key_path: null
              cancellation_foreign_key_path: null
              relation_kind: refund
              relation_foreign_goal_id: 15
              relation_key_path: transaction_id
              relation_foreign_key_path: transaction_id
              relation_foreign_value_path: amount
              relation_foreign_duplicate_operation: min
              relation_refund_operation: subtract
              denominator_cancellation_foreign_goal_id: null
              denominator_cancellation_key_path: null
              denominator_cancellation_foreign_key_path: null
              denominator_relation_kind: null
              denominator_relation_foreign_goal_id: null
              denominator_relation_key_path: null
              denominator_relation_foreign_key_path: null
              denominator_relation_foreign_value_path: null
              denominator_relation_foreign_duplicate_operation: null
              denominator_relation_refund_operation: null
              time_filter_earliest: null
              time_filter_latest: null
              denominator_time_filter_earliest: null
              denominator_time_filter_latest: null
              tags:
                - metric_id: 50
                  metric_tag_id: 2
                  metric_tag:
                    id: 2
                    tag: Business
                    created_at: 2024-02-06T10:46:54.571Z
                    created_by_user_id: 3
                    updated_at: 2025-04-04T08:24:00.939Z
                    updated_by_user_id: 3
              owners:
                - metric_id: 50
                  user_id: 3
                  user:
                    id: 3
                    external_id: null
                    email: jonas@absmartly.com
                    first_name: Jonas
                    last_name: Alves
                    department: Development
                    job_title: CEO
                    avatar_file_upload_id: 357
                    created_at: 2023-07-13T13:36:55.747Z
                    created_by_user_id: 0
                    updated_at: 2025-03-31T13:44:22.923Z
                    updated_by_user_id: 3
                    archived: false
                    consecutive_login_failures: 0
                    last_login_at: 2025-05-15T14:50:37.123Z
                    last_login_failure_at: null
                    demo_user: null
                    avatar:
                      id: 357
                      file_usage_id: 1
                      width: 1200
                      height: 1200
                      file_size: 41836
                      file_name: 01_Color Logo-square.png
                      content_type: image/png
                      base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
                      crop_left: 119.9999999999999
                      crop_top: 120
                      crop_width: 960.0000000000001
                      crop_height: 960.0000000000001
                      created_at: 2025-03-31T13:44:22.922Z
                      created_by_user_id: 3
              teams: []
        created_by:
          id: 3
          external_id: null
          email: jonas@absmartly.com
          first_name: Jonas
          last_name: Alves
          department: Development
          job_title: CEO
          avatar_file_upload_id: 357
          created_at: 2023-07-13T13:36:55.747Z
          created_by_user_id: 0
          updated_at: 2025-03-31T13:44:22.923Z
          updated_by_user_id: 3
          archived: false
          consecutive_login_failures: 0
          last_login_at: 2025-05-15T14:50:37.123Z
          last_login_failure_at: null
          demo_user: null
          avatar:
            id: 357
            file_usage_id: 1
            width: 1200
            height: 1200
            file_size: 41836
            file_name: 01_Color Logo-square.png
            content_type: image/png
            base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
            crop_left: 119.9999999999999
            crop_top: 120
            crop_width: 960.0000000000001
            crop_height: 960.0000000000001
            created_at: 2025-03-31T13:44:22.922Z
            created_by_user_id: 3
        updated_by: null
        variants:
          - experiment_id: 23736
            variant: 0
            name: ""
            config: '{"product_image_size":"200px"}'
          - experiment_id: 23736
            variant: 1
            name: ""
            config: '{"product_image_size":"400px"}'
        variant_screenshots:
          - experiment_id: 23736
            variant: 0
            screenshot_file_upload_id: 353
            label: small desktop.png
            file_upload:
              id: 353
              file_usage_id: 2
              width: 1536
              height: 1024
              file_size: 1248287
              file_name: small desktop.png
              content_type: image/png
              base_url: /files/variant_screenshots/06397e267459f21e49ff0a3a856409937f7580aa
              crop_left: 0
              crop_top: -9.001184677340322e-14
              crop_width: 1536
              crop_height: 1024
              created_at: 2025-03-28T17:48:51.682Z
              created_by_user_id: 3
          - experiment_id: 23736
            variant: 0
            screenshot_file_upload_id: 354
            label: small mobile.png
            file_upload:
              id: 354
              file_usage_id: 2
              width: 1024
              height: 1536
              file_size: 1380138
              file_name: small mobile.png
              content_type: image/png
              base_url: /files/variant_screenshots/e12a587763c73426e98d2081c1db8b8190a0a2c5
              crop_left: 0
              crop_top: 0
              crop_width: 1024
              crop_height: 1536
              created_at: 2025-03-28T17:48:51.682Z
              created_by_user_id: 3
        owners:
          - experiment_id: 23736
            user_id: 3
            user:
              id: 3
              external_id: null
              email: jonas@absmartly.com
              first_name: Jonas
              last_name: Alves
              department: Development
              job_title: CEO
              avatar_file_upload_id: 357
              created_at: 2023-07-13T13:36:55.747Z
              created_by_user_id: 0
              updated_at: 2025-03-31T13:44:22.923Z
              updated_by_user_id: 3
              archived: false
              consecutive_login_failures: 0
              last_login_at: 2025-05-15T14:50:37.123Z
              last_login_failure_at: null
              demo_user: null
              avatar:
                id: 357
                file_usage_id: 1
                width: 1200
                height: 1200
                file_size: 41836
                file_name: 01_Color Logo-square.png
                content_type: image/png
                base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
                crop_left: 119.9999999999999
                crop_top: 120
                crop_width: 960.0000000000001
                crop_height: 960.0000000000001
                created_at: 2025-03-31T13:44:22.922Z
                created_by_user_id: 3
              permissions: {}
              accessControlPolicies: []
        teams: []
        experiment_report: null
        experiment_tags:
          - experiment_id: 23736
            experiment_tag_id: 40
            experiment_tag:
              id: 40
              tag: images
              created_at: 2024-05-23T14:38:07.325Z
              created_by_user_id: 3
              updated_at: null
              updated_by_user_id: null
          - experiment_id: 23736
            experiment_tag_id: 41
            experiment_tag:
              id: 41
              tag: Product Page
              created_at: 2024-05-23T14:38:20.433Z
              created_by_user_id: 3
              updated_at: null
              updated_by_user_id: null
        custom_section_field_values:
          - experiment_id: 23736
            experiment_custom_section_field_id: 1
            type: text
            value: Increasing the size of the product image on the product page will enhance user engagement, leading to a higher
              conversion rate.
            updated_at: 2025-05-15T15:56:57.928Z
            updated_by_user_id: 3
            custom_section_field:
              id: 1
              section_id: 1
              title: Hypothesis
              help_text: Based on [prior] we think [theory]. We believe we can [outcome] by changing [implementation] for [audience].
                We know this hypothesis is supported if they will [new behavior] and we see [effect].
              placeholder: ""
              default_value: ""
              type: text
              required: false
              archived: false
              order_index: 1
              available_in_sdk: false
              sdk_field_name: null
              created_at: 2023-10-13T16:43:31.760Z
              created_by_user_id: 0
              updated_at: 2024-12-10T08:04:22.667Z
              updated_by_user_id: 50
              custom_section:
                id: 1
                title: Description
                description: "[View
                  documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1\
                  )"
                order_index: 1
                type: test
                archived: false
                created_at: 2023-10-13T16:43:31.760Z
                created_by_user_id: 0
                updated_at: null
                updated_by_user_id: null
        scheduled_actions: []
        split:
          - 0.5
          - 0.5
    page: 1
    items: 1500
    total: 647

And here's an example of a payload we need to pass to POST /experiments to create a new experiment:
    state: ready
    name: my_super_nice_experiment
    display_name: my_super_nice_experiment
    iteration: 1
    percentage_of_traffic: 100
    unit_type:
      unit_type_id: 1
    nr_variants: 2
    percentages: 50/50
    audience: '{"filter":[{"and":[{"or":[{"eq":[{"var":{"path":"country"}},{"value":"gb"}]},{"eq":[{"var":{"path":"language"}},{"value":"en-GB"}]}]}]}]}'
    audience_strict: true
    owners:
      - user_id: 3
    teams: []
    experiment_tags:
      - experiment_tag_id: 40
      - experiment_tag_id: 41
    applications:
      - application_id: 1
        application_version: "0"
    primary_metric:
      metric_id: 4
    secondary_metrics:
      - metric_id: 50
        type: secondary
        order_index: 0
      - metric_id: 49
        type: secondary
        order_index: 1
      - metric_id: 53
        type: guardrail
        order_index: 0
    variants:
      - variant: 0
        name: ""
        config: '{"product_image_size":"200px"}'
      - variant: 1
        name: ""
        config: '{"product_image_size":"400px"}'
    variant_screenshots:
      - variant: 0
        screenshot_file_upload_id: 353
        label: small desktop.png
      - variant: 0
        screenshot_file_upload_id: 354
        label: small mobile.png
      - variant: 1
        screenshot_file_upload_id: 355
        label: large desktop.png
    custom_section_field_values:
      "1":
        experiment_id: 238
        experiment_custom_section_field_id: 1
        type: text
        value: Increasing the size of the product image on the product page will enhance user engagement, leading to a higher
          conversion rate.
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 1
          section_id: 1
          title: Hypothesis
          help_text: Based on [prior] we think [theory]. We believe we can [outcome] by changing [implementation] for [audience].
            We know this hypothesis is supported if they will [new behavior] and we see [effect].
          placeholder: ""
          default_value: ""
          type: text
          required: false
          archived: false
          order_index: 1
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2023-10-13T16:43:31.760Z
          created_by_user_id: 0
          updated_at: 2024-12-10T08:04:22.667Z
          updated_by_user_id: 50
          custom_section:
            id: 1
            title: Description
            description: "[View
              documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
            order_index: 1
            type: test
            archived: false
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: null
            updated_by_user_id: null
        id: 1
        default_value: Increasing the size of the product image on the product page will enhance user engagement, leading to a
          higher conversion rate.
      "2":
        experiment_id: 238
        experiment_custom_section_field_id: 2
        type: text
        value: The purpose of this A/B test is to determine whether making the product images larger on the product page can
          lead to higher user engagement and improved sales performance.
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 2
          section_id: 1
          title: Purpose
          help_text: What customer or business needs are being addressed?
          placeholder: null
          default_value: ""
          type: text
          required: false
          archived: false
          order_index: 3
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2023-10-13T16:43:31.760Z
          created_by_user_id: 0
          updated_at: null
          updated_by_user_id: null
          custom_section:
            id: 1
            title: Description
            description: "[View
              documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
            order_index: 1
            type: test
            archived: false
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: null
            updated_by_user_id: null
        id: 2
        default_value: The purpose of this A/B test is to determine whether making the product images larger on the product page
          can lead to higher user engagement and improved sales performance.
      "3":
        experiment_id: 238
        experiment_custom_section_field_id: 3
        type: text
        value: Larger product images will attract more attention and provide a better visual representation of the product,
          resulting in an increase in the overall conversion rate by at least 1%.
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 3
          section_id: 1
          title: Prediction
          help_text: "Example: Changing ... is going to cause ..."
          placeholder: null
          default_value: ""
          type: text
          required: false
          archived: false
          order_index: 2
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2023-10-13T16:43:31.760Z
          created_by_user_id: 0
          updated_at: null
          updated_by_user_id: null
          custom_section:
            id: 1
            title: Description
            description: "[View
              documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
            order_index: 1
            type: test
            archived: false
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: null
            updated_by_user_id: null
        id: 3
        default_value: Larger product images will attract more attention and provide a better visual representation of the
          product, resulting in an increase in the overall conversion rate by at least 1%.
      "4":
        experiment_id: 238
        experiment_custom_section_field_id: 4
        type: text
        value: ""
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 4
          section_id: 1
          title: Implementation Details
          help_text: |-
            How long will it take to implement?
            What's the impact we can expect from this implementation?
            What's the minimum impact that we need to keep this experiment?
          placeholder: null
          default_value: ""
          type: text
          required: false
          archived: false
          order_index: 4
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2023-10-13T16:43:31.760Z
          created_by_user_id: 0
          updated_at: null
          updated_by_user_id: null
          custom_section:
            id: 1
            title: Description
            description: "[View
              documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
            order_index: 1
            type: test
            archived: false
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: null
            updated_by_user_id: null
        id: 4
        default_value: ""
      "7":
        experiment_id: 238
        experiment_custom_section_field_id: 7
        type: json
        value: |-
          {
            "override_guids": {
              "123w12a": 1,
              "123123": 2
            }
          }
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 7
          section_id: 2
          title: Availability Rules
          help_text: Experiment custom availability rules
          placeholder: null
          default_value: |-
            {
              "allowed_languages": ["en"],
              "override_guids": {
                "123w12a": 1,
                "123123": 2
              }
            }
          type: json
          required: true
          archived: false
          order_index: 7
          available_in_sdk: true
          sdk_field_name: availability_rules
          created_at: 2023-11-16T14:52:53.017Z
          created_by_user_id: 43
          updated_at: 2023-11-16T14:55:04.246Z
          updated_by_user_id: 43
          custom_section:
            id: 2
            title: SDK Fields
            description: ""
            order_index: 2
            type: test
            archived: false
            created_at: 2023-11-16T14:54:56.242Z
            created_by_user_id: 43
            updated_at: null
            updated_by_user_id: null
        id: 7
        default_value: |-
          {
            "override_guids": {
              "123w12a": 1,
              "123123": 2
            }
          }
      "76":
        experiment_id: 238
        experiment_custom_section_field_id: 76
        type: text
        value: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
        custom_section_field:
          id: 76
          section_id: 70
          title: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
          help_text: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
          placeholder: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
          default_value: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
          type: text
          required: false
          archived: false
          order_index: 1
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2024-12-19T11:03:51.040Z
          created_by_user_id: 44
          updated_at: 2025-04-04T11:02:28.635Z
          updated_by_user_id: 3
        id: 76
        default_value: abcd">${7*7}<img src=x onerror=document.write=1;>{{7*7}}
      "78":
        experiment_id: 238
        experiment_custom_section_field_id: 78
        type: json
        value: "{}"
        updated_at: null
        updated_by_user_id: 3
        custom_section_field:
          id: 78
          section_id: 1
          title: json field
          help_text: help json
          placeholder: ""
          default_value: "{}"
          type: json
          required: false
          archived: false
          order_index: 7
          available_in_sdk: false
          sdk_field_name: null
          created_at: 2025-02-26T07:50:01.696Z
          created_by_user_id: 68
          updated_at: null
          updated_by_user_id: null
          custom_section:
            id: 1
            title: Description
            description: "[View
              documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
            order_index: 1
            type: test
            archived: false
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: null
            updated_by_user_id: null
        id: 78
        default_value: "{}"
      "111":
        experiment_id: 238
        experiment_custom_section_field_id: 111
        type: text
        value: default value
        custom_section_field:
          id: 111
          section_id: 70
          title: test field
          help_text: test field
          placeholder: placeholder text
          default_value: default value
          type: text
          required: true
          archived: false
          order_index: 3
          available_in_sdk: true
          sdk_field_name: property_name
          created_at: 2025-04-04T11:04:15.271Z
          created_by_user_id: 3
          updated_at: 2025-04-04T11:06:37.940Z
          updated_by_user_id: 3
        id: 111
        default_value: default value
    parent_experiment_id: 238
    parent_experiment:
      id: 238
      name: Product Page Experiment
      display_name: null
      iteration: 1
      type: test_template
      state: created
      feature_state: null
      development_at: null
      start_at: null
      stop_at: null
      full_on_at: null
      full_on_variant: null
      feature_on_at: null
      feature_off_at: null
      last_seen_in_code_at: null
      nr_variants: 2
      percentages: 50/50
      percentage_of_traffic: 100
      seed: "23173137669494291"
      traffic_seed: "54519026387802315"
      created_at: 2024-05-23T14:54:53.326Z
      created_by_user_id: 3
      updated_at: 2025-03-28T17:48:53.383Z
      updated_by_user_id: 3
      unit_type_id: 1
      primary_metric_id: 4
      audience: '{"filter":[{"and":[{"or":[{"eq":[{"var":{"path":"country"}},{"value":"gb"}]},{"eq":[{"var":{"path":"language"}},{"value":"en-GB"}]}]}]}]}'
      audience_strict: true
      minimum_detectable_effect: "1"
      archived: false
      analysis_type: group_sequential
      baseline_primary_metric_mean: "79"
      baseline_primary_metric_stdev: "30"
      baseline_participants_per_day: "1428"
      required_alpha: "0.1"
      required_power: "0.8"
      group_sequential_futility_type: binding
      group_sequential_analysis_count: null
      group_sequential_min_analysis_interval: 1d
      group_sequential_first_analysis_interval: 7d
      group_sequential_max_duration_interval: 4w
      template_iteration: 2
      template_description: Updated the template with better images
      parent_experiment_id: null
      parent_experiment_iteration: null
      template_permission:
        experiment_template_id: 238
        nr_variants: editable
        percentages: editable
        percentage_of_traffic: editable
        unit_type_id: editable
        applications: editable
        primary_metric_id: editable
        audience: editable
        audience_strict: editable
        analysis_type: editable
        required_alpha: editable
        required_power: editable
        group_sequential_futility_type: editable
        group_sequential_analysis_count: editable
        group_sequential_min_analysis_interval: editable
        group_sequential_first_analysis_interval: editable
        experiment_template_secondary_metric_permissions: []
      parent_experiment: null
      applications:
        - experiment_id: 238
          application_id: 1
          application_version: "0"
          application:
            id: 1
            name: www
            description: Desktop site
            created_at: 2023-07-13T12:01:19.418Z
            created_by_user_id: 2
            updated_at: 2025-04-03T17:47:27.906Z
            updated_by_user_id: 3
            archived: false
      unit_type:
        id: 1
        name: user_id
        description: User ID
        created_at: 2023-07-13T12:12:20.443Z
        created_by_user_id: 2
        updated_at: null
        updated_by_user_id: null
        archived: false
      primary_metric:
        id: 4
        goal_id: 2
        name: Checkouts
        description: User checkouts
        type: goal_count
        effect: positive
        archived: false
        impact_alert_threshold_upper: null
        impact_alert_threshold_lower: null
        format_str: "{}"
        scale: 1
        precision: 0
        mean_format_str: "{}"
        mean_scale: 1
        mean_precision: 4
        value_source_property: ""
        property_filter: '{"filter":{"and":[]}}'
        created_at: 2023-07-17T12:07:45.773Z
        created_by_user_id: 50
        updated_at: 2024-05-24T15:29:09.613Z
        updated_by_user_id: 3
        outlier_limit_method: unlimited
        outlier_limit_lower_arg: null
        outlier_limit_upper_arg: null
        numerator_type: null
        denominator_type: null
        denominator_value_source_property: null
        denominator_goal_id: null
        denominator_property_filter: null
        denominator_outlier_limit_method: null
        denominator_outlier_limit_lower_arg: null
        denominator_outlier_limit_upper_arg: null
        retention_time: null
        retention_time_reference: null
        denominator_retention_time: null
        denominator_retention_time_reference: null
        cancellation_foreign_goal_id: null
        cancellation_key_path: null
        cancellation_foreign_key_path: null
        relation_kind: null
        relation_foreign_goal_id: null
        relation_key_path: null
        relation_foreign_key_path: null
        relation_foreign_value_path: null
        relation_foreign_duplicate_operation: null
        relation_refund_operation: null
        denominator_cancellation_foreign_goal_id: null
        denominator_cancellation_key_path: null
        denominator_cancellation_foreign_key_path: null
        denominator_relation_kind: null
        denominator_relation_foreign_goal_id: null
        denominator_relation_key_path: null
        denominator_relation_foreign_key_path: null
        denominator_relation_foreign_value_path: null
        denominator_relation_foreign_duplicate_operation: null
        denominator_relation_refund_operation: null
        time_filter_earliest: null
        time_filter_latest: null
        denominator_time_filter_earliest: null
        denominator_time_filter_latest: null
        tags:
          - metric_id: 4
            metric_tag_id: 2
            metric_tag:
              id: 2
              tag: Business
              created_at: 2024-02-06T10:46:54.571Z
              created_by_user_id: 3
              updated_at: 2025-04-04T08:24:00.939Z
              updated_by_user_id: 3
        owners:
          - metric_id: 4
            user_id: 50
            user:
              id: 50
              external_id: null
              email: cal@absmartly.com
              first_name: Cal
              last_name: Courtney
              department: ""
              job_title: ""
              avatar_file_upload_id: null
              created_at: 2022-10-19T08:26:07.583Z
              created_by_user_id: 0
              updated_at: 2025-01-10T12:09:44.772Z
              updated_by_user_id: 50
              archived: false
              consecutive_login_failures: 0
              last_login_at: 2025-04-13T17:00:43.504Z
              last_login_failure_at: 2023-04-06T14:48:08.712Z
              demo_user: null
              avatar: null
        teams: []
      secondary_metrics:
        - experiment_id: 238
          metric_id: 50
          type: secondary
          order_index: 0
          metric:
            id: 50
            goal_id: 2
            name: Checkout Nett Revenue
            description: Nett Revenue - AOV minus refunds
            type: goal_property
            effect: positive
            archived: false
            impact_alert_threshold_upper: null
            impact_alert_threshold_lower: null
            format_str: €{}
            scale: 1
            precision: 0
            mean_format_str: €{}
            mean_scale: 1
            mean_precision: 2
            value_source_property: amount
            property_filter: '{"filter":{"and":[]}}'
            created_at: 2024-05-23T14:36:25.031Z
            created_by_user_id: 3
            updated_at: 2024-05-24T15:38:03.956Z
            updated_by_user_id: 3
            outlier_limit_method: unlimited
            outlier_limit_lower_arg: null
            outlier_limit_upper_arg: null
            numerator_type: null
            denominator_type: null
            denominator_value_source_property: null
            denominator_goal_id: null
            denominator_property_filter: null
            denominator_outlier_limit_method: null
            denominator_outlier_limit_lower_arg: null
            denominator_outlier_limit_upper_arg: null
            retention_time: null
            retention_time_reference: null
            denominator_retention_time: null
            denominator_retention_time_reference: null
            cancellation_foreign_goal_id: null
            cancellation_key_path: null
            cancellation_foreign_key_path: null
            relation_kind: refund
            relation_foreign_goal_id: 15
            relation_key_path: transaction_id
            relation_foreign_key_path: transaction_id
            relation_foreign_value_path: amount
            relation_foreign_duplicate_operation: min
            relation_refund_operation: subtract
            denominator_cancellation_foreign_goal_id: null
            denominator_cancellation_key_path: null
            denominator_cancellation_foreign_key_path: null
            denominator_relation_kind: null
            denominator_relation_foreign_goal_id: null
            denominator_relation_key_path: null
            denominator_relation_foreign_key_path: null
            denominator_relation_foreign_value_path: null
            denominator_relation_foreign_duplicate_operation: null
            denominator_relation_refund_operation: null
            time_filter_earliest: null
            time_filter_latest: null
            denominator_time_filter_earliest: null
            denominator_time_filter_latest: null
            tags:
              - metric_id: 50
                metric_tag_id: 2
                metric_tag:
                  id: 2
                  tag: Business
                  created_at: 2024-02-06T10:46:54.571Z
                  created_by_user_id: 3
                  updated_at: 2025-04-04T08:24:00.939Z
                  updated_by_user_id: 3
            owners:
              - metric_id: 50
                user_id: 3
                user:
                  id: 3
                  external_id: null
                  email: jonas@absmartly.com
                  first_name: Jonas
                  last_name: Alves
                  department: Development
                  job_title: CEO
                  avatar_file_upload_id: 357
                  created_at: 2023-07-13T13:36:55.747Z
                  created_by_user_id: 0
                  updated_at: 2025-03-31T13:44:22.923Z
                  updated_by_user_id: 3
                  archived: false
                  consecutive_login_failures: 0
                  last_login_at: 2025-05-03T00:04:32.549Z
                  last_login_failure_at: null
                  demo_user: null
                  avatar:
                    id: 357
                    file_usage_id: 1
                    width: 1200
                    height: 1200
                    file_size: 41836
                    file_name: 01_Color Logo-square.png
                    content_type: image/png
                    base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
                    crop_left: 119.9999999999999
                    crop_top: 120
                    crop_width: 960.0000000000001
                    crop_height: 960.0000000000001
                    created_at: 2025-03-31T13:44:22.922Z
                    created_by_user_id: 3
            teams: []
      created_by:
        id: 3
        external_id: null
        email: jonas@absmartly.com
        first_name: Jonas
        last_name: Alves
        department: Development
        job_title: CEO
        avatar_file_upload_id: 357
        created_at: 2023-07-13T13:36:55.747Z
        created_by_user_id: 0
        updated_at: 2025-03-31T13:44:22.923Z
        updated_by_user_id: 3
        archived: false
        consecutive_login_failures: 0
        last_login_at: 2025-05-03T00:04:32.549Z
        last_login_failure_at: null
        demo_user: null
        avatar:
          id: 357
          file_usage_id: 1
          width: 1200
          height: 1200
          file_size: 41836
          file_name: 01_Color Logo-square.png
          content_type: image/png
          base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
          crop_left: 119.9999999999999
          crop_top: 120
          crop_width: 960.0000000000001
          crop_height: 960.0000000000001
          created_at: 2025-03-31T13:44:22.922Z
          created_by_user_id: 3
      updated_by:
        id: 3
        external_id: null
        email: jonas@absmartly.com
        first_name: Jonas
        last_name: Alves
        department: Development
        job_title: CEO
        avatar_file_upload_id: 357
        created_at: 2023-07-13T13:36:55.747Z
        created_by_user_id: 0
        updated_at: 2025-03-31T13:44:22.923Z
        updated_by_user_id: 3
        archived: false
        consecutive_login_failures: 0
        last_login_at: 2025-05-03T00:04:32.549Z
        last_login_failure_at: null
        demo_user: null
        avatar:
          id: 357
          file_usage_id: 1
          width: 1200
          height: 1200
          file_size: 41836
          file_name: 01_Color Logo-square.png
          content_type: image/png
          base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
          crop_left: 119.9999999999999
          crop_top: 120
          crop_width: 960.0000000000001
          crop_height: 960.0000000000001
          created_at: 2025-03-31T13:44:22.922Z
          created_by_user_id: 3
      variants:
        - experiment_id: 238
          variant: 0
          name: ""
          config: '{"product_image_size":"200px"}'
        - experiment_id: 238
          variant: 1
          name: ""
          config: '{"product_image_size":"400px"}'
      variant_screenshots:
        - experiment_id: 238
          variant: 0
          screenshot_file_upload_id: 353
          label: small desktop.png
          file_upload:
            id: 353
            file_usage_id: 2
            width: 1536
            height: 1024
            file_size: 1248287
            file_name: small desktop.png
            content_type: image/png
            base_url: /files/variant_screenshots/06397e267459f21e49ff0a3a856409937f7580aa
            crop_left: 0
            crop_top: -9.001184677340322e-14
            crop_width: 1536
            crop_height: 1024
            created_at: 2025-03-28T17:48:51.682Z
            created_by_user_id: 3
        - experiment_id: 238
          variant: 0
          screenshot_file_upload_id: 354
          label: small mobile.png
          file_upload:
            id: 354
            file_usage_id: 2
            width: 1024
            height: 1536
            file_size: 1380138
            file_name: small mobile.png
            content_type: image/png
            base_url: /files/variant_screenshots/e12a587763c73426e98d2081c1db8b8190a0a2c5
            crop_left: 0
            crop_top: 0
            crop_width: 1024
            crop_height: 1536
            created_at: 2025-03-28T17:48:51.682Z
            created_by_user_id: 3
      owners:
        - experiment_id: 238
          user_id: 3
          user:
            id: 3
            external_id: null
            email: jonas@absmartly.com
            first_name: Jonas
            last_name: Alves
            department: Development
            job_title: CEO
            avatar_file_upload_id: 357
            created_at: 2023-07-13T13:36:55.747Z
            created_by_user_id: 0
            updated_at: 2025-03-31T13:44:22.923Z
            updated_by_user_id: 3
            archived: false
            consecutive_login_failures: 0
            last_login_at: 2025-05-03T00:04:32.549Z
            last_login_failure_at: null
            demo_user: null
            avatar:
              id: 357
              file_usage_id: 1
              width: 1200
              height: 1200
              file_size: 41836
              file_name: 01_Color Logo-square.png
              content_type: image/png
              base_url: /files/avatars/f7bd44c4acd4bb53061cd648f138ada1bc4c112e
              crop_left: 119.9999999999999
              crop_top: 120
              crop_width: 960.0000000000001
              crop_height: 960.0000000000001
              created_at: 2025-03-31T13:44:22.922Z
              created_by_user_id: 3
            permissions: {}
            accessControlPolicies: []
      teams: []
      experiment_report: null
      experiment_tags:
        - experiment_id: 238
          experiment_tag_id: 40
          experiment_tag:
            id: 40
            tag: images
            created_at: 2024-05-23T14:38:07.325Z
            created_by_user_id: 3
            updated_at: null
            updated_by_user_id: null
        - experiment_id: 238
          experiment_tag_id: 41
          experiment_tag:
            id: 41
            tag: Product Page
            created_at: 2024-05-23T14:38:20.433Z
            created_by_user_id: 3
            updated_at: null
            updated_by_user_id: null
      custom_section_field_values:
        - experiment_id: 238
          experiment_custom_section_field_id: 1
          type: text
          value: Increasing the size of the product image on the product page will enhance user engagement, leading to a higher
            conversion rate.
          updated_at: null
          updated_by_user_id: 3
          custom_section_field:
            id: 1
            section_id: 1
            title: Hypothesis
            help_text: Based on [prior] we think [theory]. We believe we can [outcome] by changing [implementation] for [audience].
              We know this hypothesis is supported if they will [new behavior] and we see [effect].
            placeholder: ""
            default_value: ""
            type: text
            required: false
            archived: false
            order_index: 1
            available_in_sdk: false
            sdk_field_name: null
            created_at: 2023-10-13T16:43:31.760Z
            created_by_user_id: 0
            updated_at: 2024-12-10T08:04:22.667Z
            updated_by_user_id: 50
            custom_section:
              id: 1
              title: Description
              description: "[View
                documentation](https://docs.absmartly.com/docs/web-console-docs/creating-an-experiment/#description-1)"
              order_index: 1
              type: test
              archived: false
              created_at: 2023-10-13T16:43:31.760Z
              created_by_user_id: 0
              updated_at: null
              updated_by_user_id: null
      scheduled_actions: []
      preview_variants:
        - experiment_id: 238
          environmentType: production
          variant: 0
          metric_id: 4
          unit_count: 0
          first_exposure_at: 0
          last_exposure_at: 0
          value: "0"
          mean: "0"
          stdev: "0"
          variance: "0"
          pvalue: null
          impact: null
          impact_lower: null
          impact_upper: null
        - experiment_id: 238
          environmentType: production
          variant: 1
          metric_id: 4
          unit_count: 0
          first_exposure_at: 0
          last_exposure_at: 0
          value: "0"
          mean: "0"
          stdev: "0"
          variance: "0"
          pvalue: null
          impact: null
          impact_lower: null
          impact_upper: null
      alerts: []
      sample_size: null
      group_sequential_analyses: []
      recommended_action: null
      experiment_task_states: []
      split:
        - 0.5
        - 0.5
      iterations:
        - id: 238
          name: Product Page Experiment
          display_name: null
          iteration: 1
          type: test_template
          state: created
          feature_state: null
          development_at: null
          start_at: null
          stop_at: null
          full_on_at: null
          full_on_variant: null
          feature_on_at: null
          feature_off_at: null
          last_seen_in_code_at: null
          nr_variants: 2
          percentages: 50/50
          percentage_of_traffic: 100
          seed: "23173137669494291"
          traffic_seed: "54519026387802315"
          created_at: 2024-05-23T14:54:53.326Z
          created_by_user_id: 3
          updated_at: 2025-03-28T17:48:53.383Z
          updated_by_user_id: 3
          unit_type_id: 1
          primary_metric_id: 4
          audience: '{"filter":[{"and":[{"or":[{"eq":[{"var":{"path":"country"}},{"value":"gb"}]},{"eq":[{"var":{"path":"language"}},{"value":"en-GB"}]}]}]}]}'
          audience_strict: true
          minimum_detectable_effect: "1"
          archived: false
          analysis_type: group_sequential
          baseline_primary_metric_mean: "79"
          baseline_primary_metric_stdev: "30"
          baseline_participants_per_day: "1428"
          required_alpha: "0.1"
          required_power: "0.8"
          group_sequential_futility_type: binding
          group_sequential_analysis_count: null
          group_sequential_min_analysis_interval: 1d
          group_sequential_first_analysis_interval: 7d
          group_sequential_max_duration_interval: 4w
          template_iteration: 2
          template_description: Updated the template with better images
          parent_experiment_id: null
          parent_experiment_iteration: null
          split:
            - 0.5
            - 0.5
    parent_experiment_iteration: 2
    template_permission:
      nr_variants: editable
      percentages: editable
      percentage_of_traffic: editable
      unit_type_id: editable
      applications: editable
      primary_metric_id: editable
      audience: editable
      audience_strict: editable
      analysis_type: editable
      required_alpha: editable
      required_power: editable
      group_sequential_futility_type: editable
      group_sequential_analysis_count: editable
      group_sequential_min_analysis_interval: editable
      group_sequential_first_analysis_interval: editable
      experiment_template_secondary_metric_permissions: []
    template_name: ""
    template_description: Updated the template with better images
    type: test
    analysis_type: group_sequential
    baseline_primary_metric_mean: "79"
    baseline_primary_metric_stdev: "30"
    baseline_participants_per_day: "1428"
    required_alpha: "0.100"
    required_power: "0.800"
    group_sequential_futility_type: binding
    group_sequential_analysis_count: null
    group_sequential_min_analysis_interval: 1d
    group_sequential_first_analysis_interval: 7d
    group_sequential_max_duration_interval: 4w

The MCP server API client code looks like this:
import { ABsmartlyResponse, ListExperimentsParams } from './types';
import { debug } from './config';
export class ABsmartlyAPIClient {
  private authToken: string;
  private authType: 'jwt' | 'api-key';
  private baseUrl: string;
  constructor(authToken: string, baseUrl: string = 'https://sandbox.absmartly.com', authType?: 'jwt' | 'api-key') {
    baseUrl = baseUrl.replace(/\/$/, '');
    if (baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 3);
    }
    debug('🔧 ABsmartlyAPIClient constructor:', {
      tokenLength: authToken?.length,
      tokenPreview: authToken?.substring(0, 20) + '...',
      baseUrl,
      authType
    });
    this.authToken = authToken;
    this.baseUrl = baseUrl;
    if (authType) {
      this.authType = authType;
      debug('🔧 Using provided auth type:', authType);
    } else {
      this.authType = authToken.includes('.') && authToken.split('.').length === 3 ? 'jwt' : 'api-key';
      debug('🔧 Auto-detected auth type:', this.authType);
    }
    if (this.authType === 'jwt') {
      try {
        const parts = authToken.split('.');
        debug('🔍 JWT analysis:', {
          parts: parts.length,
          header: parts[0]?.substring(0, 20) + '...',
          payload: parts[1]?.substring(0, 20) + '...',
          signature: parts[2]?.substring(0, 20) + '...'
        });
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          debug('🔍 JWT payload keys:', Object.keys(payload));
          debug('🔍 JWT payload preview:', {
            iss: payload.iss,
            sub: payload.sub,
            aud: payload.aud,
            exp: payload.exp,
            iat: payload.iat,
            token: payload.token ? 'present' : 'missing',
            email: payload.email,
            hasTokenField: 'token' in payload
          });
        }
      } catch (jwtError) {
        console.error('❌ Failed to analyze JWT:', (jwtError as Error).message);
      }
    }
  }
  get apiEndpoint(): string {
    return this.baseUrl;
  }
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ABsmartlyResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.authType === 'jwt' ? `JWT ${this.authToken}` : `Api-Key ${this.authToken}`;
    const headers = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'User-Agent': 'ABsmartly-MCP-Server/1.0.0',
      ...options.headers,
    };
    debug(`🔗 ABsmartly API Request: [Auth: ${this.authType === 'jwt' ? 'JWT' : 'Api-Key'}] ${options.method || 'GET'} ${url}`);
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        debug('📄 Non-JSON response:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyPreview: text.slice(0, 500)
        });
        data = { message: text };
      }
      if (response.ok) {
        debug(`📡 ABsmartly API Response: ${response.status} ${response.ok ? 'OK' : 'ERROR'} ${url} ${JSON.stringify(data).slice(0, 200)}`);
      } else {
        const errorMessage = data.errors ? data.errors.join(', ') : data.error || response.statusText;
        debug(`❌ ABsmartly API Error: ${response.status} ${url} "${errorMessage}" - ${JSON.stringify(data).slice(0, 200)}`);
      }
      if (!response.ok) {
        const errorDetails = {
          status: response.status,
          statusText: response.statusText,
          url: url,
          method: options.method || 'GET',
          responseData: data
        };
        return {
          ok: false,
          errors: data.errors || data.error || [`HTTP ${response.status}: ${response.statusText}`],
          details: errorDetails
        };
      }
      return {
        ok: true,
        data,
      };
    } catch (error) {
      debug('💥 ABsmartly API Error:', error);
      return {
        ok: false,
        errors: [`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }
  async listExperiments(params?: ListExperimentsParams): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          // All values are already strings or can be converted to strings
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/experiments${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getExperiment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}`);
  }
  async createExperiment(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/experiments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateExperiment(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async startExperiment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}/start`, {
      method: 'PUT',
    });
  }
  async stopExperiment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}/stop`, {
      method: 'PUT',
    });
  }
  async restartExperiment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}/restart`, {
      method: 'PUT',
    });
  }
  async setExperimentFullOn(id: number, data?: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}/full_on`, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async setExperimentToDevelopment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${id}/development`, {
      method: 'PUT',
    });
  }
  async listGoals(): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/goals');
  }
  async getGoal(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/goals/${id}`);
  }
  async createGoal(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateGoal(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listMetrics(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/metrics${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getMetric(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/metrics/${id}`);
  }
  async createMetric(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateMetric(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/metrics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listUsers(): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/users');
  }
  async getUser(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/users/${id}`);
  }
  async getCurrentUser(): Promise<ABsmartlyResponse> {
    return this.makeRequest('/auth/current-user');
  }
  async createUser(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateUser(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listTeams(): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/teams');
  }
  async getTeam(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/teams/${id}`);
  }
  async createTeam(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateTeam(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async getExperimentMetrics(experimentId: number, metricId: number, params?: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/metrics/${metricId}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }
  async getExperimentMetricHistory(experimentId: number, metricId: number, params?: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/metrics/${metricId}/history`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }
  async getExperimentParticipants(experimentId: number, params?: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/participants/history`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  }
  async getExperimentActivity(experimentId: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/activity`);
  }
  async addExperimentActivity(experimentId: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/activity`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async archiveExperiment(experimentId: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/archive`, {
      method: 'PUT',
    });
  }
  async setExperimentDevelopment(experimentId: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiments/${experimentId}/development`, {
      method: 'PUT',
    });
  }
  async listApplications(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/applications${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getApplication(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/applications/${id}`);
  }
  async createApplication(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateApplication(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listUnitTypes(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/unit_types${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getUnitType(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/unit_types/${id}`);
  }
  async createUnitType(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/unit_types', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateUnitType(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/unit_types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listEnvironments(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/environments${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getEnvironment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/environments/${id}`);
  }
  async getInsightsSummary(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/insights/summary${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getInsightsVelocity(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/insights/velocity/widgets${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getInsightsDecisions(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/insights/decisions/widgets${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getInsightsDecisionHistory(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/insights/decisions/history${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async listSegments(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/segments${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getSegment(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/segments/${id}`);
  }
  async createSegment(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/segments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateSegment(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/segments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async listExperimentCustomSectionFields(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/experiment_custom_section_fields${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getExperimentCustomSectionField(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiment_custom_section_fields/${id}`);
  }
  async uploadVariantScreenshot(data: {
    data: string;
    file_name: string;
    file_size: number;
    content_type: string;
    width: number;
    height: number;
    crop_left?: number;
    crop_top?: number;
    crop_width?: number;
    crop_height?: number;
  }): Promise<ABsmartlyResponse> {
    const payload = {
      usage: "variant_screenshots",
      file: {
        data: data.data,
        file_name: data.file_name,
        file_size: data.file_size,
        content_type: data.content_type,
        width: data.width,
        height: data.height,
        crop_left: data.crop_left || 0,
        crop_top: data.crop_top || 0,
        crop_width: data.crop_width || data.width,
        crop_height: data.crop_height || data.height
      }
    };
    return this.makeRequest('/v1/file_uploads/variant_screenshots', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async listExperimentTags(params?: any): Promise<ABsmartlyResponse> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, value.toString());
        }
      });
    }
    const endpoint = `/v1/experiment_tags${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    return this.makeRequest(endpoint);
  }
  async getExperimentTag(id: number): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiment_tags/${id}`);
  }
  async createExperimentTag(data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest('/v1/experiment_tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  async updateExperimentTag(id: number, data: any): Promise<ABsmartlyResponse> {
    return this.makeRequest(`/v1/experiment_tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
  async request(endpoint: string, options: RequestInit = {}): Promise<ABsmartlyResponse> {
    return this.makeRequest(endpoint, options);
  }
}

Please create a plan for this project. I also need a PRD and a prompt I can pass to Claude Code to build this browser extension. Be sure to use scafolding package to build the extension that makes it work not only in Chrome but also in all the major browsers.

