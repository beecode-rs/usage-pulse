- /writing-clean-ts ok this is not a util @src/main/util/session-transcript-util.ts function, move it to src/lib folder this is the claude specific business logic but this can be extracted at some point, so move it in the library layer and call it something appropriate like claude parser or reader, be creative
- move it in its own folder and you can break it into service.ts and additional files if needed to group functionalities, currently file is big
---
- /writing-clean-ts @src/main/util/sessions-util.ts is not an util, rename it and move to business/service folder the service layer
---
- /writing-clean-ts @src/main/util/version-compare-util.ts if we have private functions in our simple object we must convert it into class and have functions starting with _ as protected. rewrite this file
- if the function returns the boolean functions it must also start as we have the rule for the boolean variables, fix the name resolveIsNewerVersion in @src/main/util/version-compare-util.ts  /writing-clean-ts---
- In the utile version compare (@src/main/util/version-compare-util.ts) there is constant for the regex for the version number. We need to move this to the util constants and give it a better name like regex for digit or something that will better explain the regex use and not where it is used
- yes (@src/main/util/version-compare-util.contract.yaml)
- use the /writing-clean-ts on @src/main/util/constant.ts
- wrap all constants into a simple object export the constants are keys of the simole object (@src/main/util/constant.ts)
- we need to update the constant name for regex, every regex value must end with Regex and not Pattern
- i see that we have multiple regex constants across the code. move them all to util/constant.ts file
- extract it too
---
- /writing-clean-ts check all the src .ts files and if we have a simple object export and we have functions with _ prefix in name, convert object into class and all functions with _ prefix must be protected
---
- /writing-clean-ts looking at the @src/main/business/use-case/settings-use-case.ts it look like something that is run in the beginning of the app like a serup, we should use app-boot layer for this, use /implementing-msh skill for implementing the msh app boot
---
- /writing-clean-ts in some parts of the code we are using process.env. the env variable must only be called from config util. move all env keys to config and use config throught the code
---
- /implementing-msh check how we implement msh-env (src/main/util/config.ts), we don't need to use .value anymore, we now use mshEnvResolver
- we need to move other .env values from getter to envConfig using env() (src/main/util/config.ts)
- i don't like changing the value of the config, the config value should only come from the .env or from args at the moment of start, any change in the config is changing how the app started, chan we find a better way of solving this issue. can we use memory global variable and set it's value on startup copy the current value from the config, and have this function markNoSandboxReexecDone be called from the util layer and change the inmemory variable, it would solve the same thing, but we would not change the value of the config which must be imutable what we get by using mshEnvResolver. also if separate getter processEnv, from the config this is raw env value and config is a const object imutable
---
- add contracts for @src/main/util/constant.ts regex values
- move the @src/main/util/_constant-contract-harness.ts to __tests__ folder like jest has it, this is only for tests
---
- in @src/main/util/os-util.ts do not return string, return enum OS with UPPER_CASE_NAMES
---
- we still have export const UPPER_CASE_NAME constant and config values, move values that can be set using env to config, and values that should not be change by user to constants. make sure that the name reflects what the value is and not what the value is used for. if it makes sense to group constant or config in values buy grouping them by name of where they are being used
- i see that we are using throught the code the process.platform, we encapsulated the platofrm into the OS enum and we have a util function to extract the OS enum using @src/main/util/os-util.ts (targets: src/main/index.ts, src/main/lib/app-window.ts, src/main/lib/dev-desktop-entry.ts, src/main/business/service/trigger-command-service.ts)
---
- in @src/shared/util/constant.ts fix regex name to reflect what regex checks and not what it is used for
---
- in sec shared folder (@src/shared) group models into business model folder
- enum must be in separate file and the name if the enum must be the file name plus enum suffix. and enums are a part of business model so move them to model folder
- file name that holds only enum must have the enum suffix but the actual enum that is exportet must not have the Enum suffix
- fix the mappers as well, thi file name ends with mapper-enum.ts
---
- ok lets move it (src/shared/provider-catalog.ts) to shared business model, and rename the it from entity to model. and if we don't need to use interface i would rather it to be type, like other models
---
- wirte contract tests for @src/shared/util/constant.ts
---
- we are currently using string union type for the provider id, for example in UsageModel (@src/shared/business/model/usage-model.ts) we must move the providers to enum and use them instead of string zai, claude and dummy.
---
- if you find type that start with I rename it by removing I as in Interface this is leftover from when we replaced interface with type. suggest a bettter name if removing I creates some conflict in naming
---
- src/shared/business/enum/session-sound-id-enum.ts: session sound id enum is actually a mapper, rename it
- src/shared/business/enum/session-sound-mapper-enum.ts: session sound mapper enum soinds that it is only for session which currently is, but we must name our models what they are and not where they are used. so call it sound name mapper
---
@src/shared/business/model/trigger-model.ts name is so vage it is not explaining what the trigger is actually a schedule trigget. trigger is a good name but in our app we have multiple triggers one for schedule, one for usage reload per provider and one for session reload
---
- in the code we must convert string union types into enum and make new files per enum (like ScheduleTriggerRunPhase)
- all enums that have different key vlaue names must have mapper in the name
---
- move all enums into a folder next to model named enum. in src main and shared, where you find an enum in model folder, just move it to folder next to that model folder named enum
---
- in the schedule trigger ts (@src/shared/business/model/schedule-trigger-model.ts) in shared golder we have a lots of config hardcoded vslues, move them to util/config. there is one constant vslue max window schedule trigger preset, move it to util consstsnt
- we still have some export interface replace them with export type, we must use interface only if we are using inheritance for class
---
- in @src/shared/util/constant.ts if multiple keys have the same prefix like scheduleTriggerRun or scheduleTriggerRunLog create a parent kye like scheduleTriggerRun and scheduleTriggerRun.log.
- do the same for planner, scheduleTrigger but move min/max. also move min/max to other const values more to the right to the value it is representing, not the feature, like scheduleTrigger
- do the same for the default like min and max
---
- in the constants we are using different time valuse, like seconds, hours, minutes, we need to standardise the time and use only milliseconds ms
- we still have minutes in planner under constants (@src/shared/util/constant.ts), use ms here as well
---
- @src/shared/business/model/trigger-planner-model.ts has some business logic, split the model definition from business locig, move the business logic to the service layer and leave the model here
---
- usage model in shared folder (@src/shared/business/model/usage-model.ts) has model and usage api client definition split them and leve the model here and move the api info to business layer service layer
---
- session focuse support status (@src/shared/business/enum/session-focus-support-status-mapper-enum.ts) has only two options, convert it into boolean flag and remove the enum
---
- rename claude token surce "enum" (@src/shared/business/enum/claude-token-source-enum.ts) to claude access token source
- i see that we are callinf it a token source in other places to, replace all to reflect the access token source brcause token means two thinks in our project, one is access token and the other is llm token (@src/renderer/src/util/tracker-token-source-util.ts, @src/main/business/service/claude-system-token-service.ts, tokenSource identifier across src/)
---
- rename usage status enum (@src/shared/business/enum/usage-status-enum.ts) to be usage activity ststus. if anyone called to get usage status the new name must be reflected on them as well
---
- in model folder (@src/renderer/src/business/model/) we must only have models if you have any type or class that ends with entity rename it to model
---
- lets fix the need for the public function in app window lifecicle (src/main/app-boot/app-window-life-cycle.ts) getwindow, use suggestion from @resource/doc/life-cycle-audit.md . if we have some reusable business logic in the lifecycle, extract it to business or lib layer. if this logic needs to be persistant we can always use singleton pattern from msh-util
---
- move the ipc controller register code with services into a controller layer (@src/main/controller/ipc-controller.ts) and only call the wrapper register call from lifecycle (@src/main/app-boot/ipc-registration-life-cycle.ts)
- can we remove the dependency injection in ipc controller and import services needed using node import (@src/main/controller/ipc-controller.ts)
---
- we need to merge app window store (@src/main/lib/app-window-store.ts + @src/main/lib/app-window-store-singleton.ts) into one file. the file name must be singleton and the singleton is exported normaly, and the original clasd is exported but we must add the _ as a prefix to class name to make it known to others that it shuld not be used
---
- dont use params. in the body of the function. do the destruction in the first line of the function body. check whole src folder. fsn out subagents to do the job one subagent per file and you must find the files that have params. in the body
- there are still some `params.` in the the code i found one in scheduling strategy folder. cheeck in other places and fix them to use params destructor as first line in function body
---
- Finish the params-destructuring task: wait for the last 3 agents (session-finished-pulse.tsx, session-card.tsx, ssh-hosts-dialog.tsx), then run central verification in /home/milos/code/usage-pulse: (1) rg -n '\bparams\.' src --type ts to list any remaining dot-reads and confirm each is an intentional skip (onUpdate listener-collision methods in usage-poll-service/sessions-poll-service/update-service, settings-service _sanitizeTracker/_sanitizeTrigger/_sanitizeSshHost, scheduling-strategy factory resolve); (2) pnpm typecheck; (3) pnpm lint-fix:eslint and pnpm lint-fix:prettier (or targeted eslint --fix / prettier --write on changed files) then pnpm lint to confirm clean - watch for no-shadow complaints in side-menu.tsx resolveBrandDotClassName and trigger-command-service _captureChunk; (4) pnpm test:contract. Fix any real breakage found (type errors, lint errors, test failures) directly, then report the final summary: files touched, total functions destructured, intentional skips with reasons, verification results.
---
- i found one more file that has singleton, settings-repo (@src/main/business/repo/settings-repo.ts + @src/main/business/repo/settings-repo-singleton.ts). i  need you to merge them into one file with singleton at the  end. and make the original class, the one used in the  singletin pattern, protected by adding _ in front of the  name. check it there is any other file that has the same pattern
---
- wherever we have a switch that uses enum and uses all the enum in the switch casees we must use in the defaukt the exhaustiveError from the msh-util typeUtil. there is one in components in factory.ts, but check other code as well
---
- we must move any default value for function args in the arg section and never in the params destruction first line in function body
- we still need to use params object, but define the defaults using params
- I actually ment to do it differently
for SchedulingStrategyFactory it should look like this 
```ts
  resolve(params: { platform?: OS } = { platform: osUtil.resolvePlatform()}): SchedulingStrategy {
```

so the default must be in the args section of the function
---

- can we move the default to the arg section of the function in this function (src/renderer/src/ui-component/scheduling/add-trigger-dialog.tsx)

export const AddTriggerDialog = (props: {
  initialPreset?: ScheduleTriggerPreset
  onClose: () => void
  onSaved: () => void
}): ReactElement => {
  const { initialPreset, onClose, onSaved } = { initialPreset: constant.maxWindowScheduleTriggerPreset, ...props }
- do the same for props

like this
  const { size } = { size: DEFAULT_ICON_SIZE, ...props }
 in tsx files, move the default to args section
 (targets: src/renderer/src/ui-component/provider/provider-icon.tsx and the 9 icon components under src/renderer/src/ui-component/icon/)
- so for the tsx we use props instead of params, but we need to have props as an object
 (targets: src/renderer/src/ui-component/scheduling/add-trigger-dialog.tsx, src/renderer/src/ui-component/provider/provider-icon.tsx and the 9 icon components under src/renderer/src/ui-component/icon/)
---
- we need to make settings use case (@src/main/business/use-case/settings-use-case-singleton.ts) not singlton, use case should be ststeles call. also we dont wwant to use deoendenci injection in the constructor so use nodejs import instrad
---
- we dont use dipendenci injection if not needed through constructor, if we can use nodejs import use thst
---
- in ClaudeTranscriptParserService (src/main/lib/claude-transcript-parser/service.ts) we have some functiond that produce sideeffect. we prefer functional programming, so we never mutate variables that are passed in to the function
---
- we need to move the file system write read logic to the dal layer and leave repo layer to work with abstrsct storage. the dal layer is whete the actal storage framework lives, and repo is clear business logic for storing data (targets: src/main/business/repo/settings-repo-singleton.ts, src/main/business/repo/usage-snapshot-repo.ts, src/main/business/repo/trigger-run-log-repo-singleton.ts)
- repo should not know anything about saving to file or reading from file, or even where the file is located. everithing regarding file is in dal. we are using words like save edit create remove in out business logic repo. read write is for file dal. we can have one common file dal to encapsulet repeating things in file dal, and have one dal for each repo
---
- implement tjr rxjs event bus and replace listeners subscriver with event bus emmit message and subscribe to message so the logic is decoupled. /orchestrating-ts-agents
- i see the event bus implementstion in lib, but i dont see it being used anywhere. we where suposed to replace the listeners and subscribers to the listeners with event bus like in visualiser project. i dont see the rxjs controller where we subscribe to things and we need an easy way to emit i thing we use util layer in visualiser project
---
- check all src files and if we are passing service objects through constructor , dont, stop using dependancy injection of services using constructor params, use node import instead
---
- can we have one universal emuter in util folder that we can emit any message by type and expect paykoad based on generic message type. like we do in @../visualiser/ project (targets: src/main/lib/event-bus/event-bus.ts, src/main/business/service/app-event-bus-singleton.ts)
---
- move lifecycle classes (src/main/app-boot/*-life-cycle.ts) into a subfolder life-cycle
---
- EventBusUtil (src/main/util/event-bus-util.ts) looks more like a lib layer code than the util
---
- ok we must move the app settings storage to repo layer and have a memory dal layer for it. so creste a common-memory-dal file and reuse it in app-settings-dal which is going to be used in app-settings-repo. so the goal is to extract the appSettings from settings lifecycle (src/main/app-boot/life-cycle/settings-life-cycle.ts). we still need ti setup the appSettings using lifecycle as a first lifecycle. /orchestrating-ts-agents
- Rename the file Dal and Message Dal to both have common in front of the name. (targets: src/main/dal/file-dal.ts, src/main/dal/memory-dal.ts)
---
- there is no need to have two ways of loading settings, it may be confusing. in this case it is ok to have settings in memory and on file, but the flow must be done this way. when the app starts the settings is loaded from file and placed in memory. whanevet the in memory value is changed we must update the file storing the settings. we need to merge appSettings repo and setting repo into one (targets: src/main/business/repo/app-settings-repo-singleton.ts, src/main/business/repo/settings-repo-singleton.ts), that only exposes the memory value. it is fetch synced, the only async call is done from app boot layer as an repo init and it fetches the settings from file. so the file reading is not accrssible from repo or business logic, it must live in the dal layer. /orchestrating-ts-agents
---
- Merge the two settings repos in the Electron app at /home/milos/code/usage-pulse (pnpm, not a monorepo) into a single repo with sync in-memory reads, one async init, and write-through file persistence.

## Background (current state, all verified)

- `src/main/business/repo/settings-repo-singleton.ts` — `_SettingsRepo` + `settingsRepoSingleton`. Async `load()` reads file via dal, returns defaults (SettingsService.createDefaultSettings) or sanitizeSettings({rawSettings}); `save()` writes file via dal and emits AppEventType.SETTINGS_SAVED on appEventBusSingleton.
- `src/main/dal/settings-dal.ts` — `SettingsDal extends CommonFileDal` with `_readJsonFile`/`_writeJsonFile`; file path `join(app.getPath('userData'), 'usage-pulse-settings.json')`, constructor takes optional `{ settingsFilePath }` override.
- `src/main/business/repo/app-settings-repo-singleton.ts` — `_AppSettingsRepo` + `appSettingsRepoSingleton` over `IAppSettingsDal`; async load() throws 'app settings are not initialized' when empty; save() writes memory.
- `src/main/dal/app-settings-dal.ts` — `AppSettingsDal extends CommonMemoryDal<AppSettings>` with `_readValue`/`_writeValue`.
- `src/main/dal/common-memory-dal.ts` and `src/main/dal/common-file-dal.ts` — the two storage base classes (read them first).
- `src/main/app-boot/life-cycle/settings-life-cycle.ts` — `_createFn` currently: loads from file repo, saves into app-settings repo, saves back to file repo (always rewrites sanitized settings on boot), then `schedulingService.syncRegistrations({ settings }).catch(() => undefined)`.
- Consumers of `appSettingsRepoSingleton().load()`: `src/main/app-boot/life-cycle/usage-poll-life-cycle.ts`, `src/main/app-boot/life-cycle/sessions-poll-life-cycle.ts` (both read-only).
- Consumers of `settingsRepoSingleton()`: `src/main/business/use-case/settings-use-case.ts` (load + several saves), `src/main/business/service/trigger-runner-service.ts` (load).
- The AppSettings model is `src/shared/business/model/settings-model.ts` — keep unchanged.

## Target design (user-mandated, follow exactly)

One repo, one dal; delete the app-settings pair entirely.

**Repo** (`settings-repo-singleton.ts`, keep file/class/singleton names):
- `init(): Promise<void>` — the ONLY async method, called once from app boot. Reads raw file via dal (`readSettingsFile`), maps undefined → `new SettingsService().createDefaultSettings()`, else `sanitizeSettings({ rawSettings })`, stores the result via dal write (memory + file write-through, which also preserves the current boot behavior of rewriting the sanitized/legacy-migrated value back to the file). Does NOT emit SETTINGS_SAVED (at boot no renderer windows exist; the event is for real saves).
- `fetch(): AppSettings` — sync read of the memory value; throws if init has not run (keep a message like 'settings are not initialized').
- `save(params: { settings: AppSettings }): Promise<void>` — write-through via dal (memory + file), then emit `{ payload: settings, type: AppEventType.SETTINGS_SAVED }` on appEventBusSingleton.
- `ISettingsDal` interface stays declared in the repo file (project convention), now: `readSettingsFile: () => Promise<unknown>`, `readSettings: () => AppSettings | undefined` (sync, memory), `writeSettings: (params: { settings: AppSettings }) => Promise<void>` (memory + file).

**Dal** (`settings-dal.ts`): `SettingsDal` owns both storages — extends `CommonFileDal` for the file and composes a `CommonMemoryDal<AppSettings>` instance for the runtime memory. Keep the optional `{ settingsFilePath }` constructor param (needed by tests). No business logic in the dal (no defaults/sanitize — that stays in the repo via SettingsService).

**Consumer updates**:
- `settings-life-cycle.ts`: `_createFn` → `await settingsRepoSingleton().init()`, then `const settings = settingsRepoSingleton().fetch()` for the existing `schedulingService.syncRegistrations({ settings }).catch(() => undefined)`. Drop the app-settings repo field and the manual save calls.
- `usage-poll-life-cycle.ts` + `sessions-poll-life-cycle.ts`: replace `await this._appSettingsRepo.load()` with sync `this._settingsRepo.fetch()`; rename the protected field accordingly.
- `settings-use-case.ts`: every `await settingsRepoSingleton().load()` becomes sync `settingsRepoSingleton().fetch()`; save calls stay as-is.
- `trigger-runner-service.ts`: `this._settingsRepo.load()` → `this._settingsRepo.fetch()` (sync).

**Delete**: `src/main/business/repo/app-settings-repo-singleton.ts`, `src/main/dal/app-settings-dal.ts`, `src/main/business/repo/_app-settings-repo-contract-harness.ts`, `src/main/business/repo/app-settings-repo-singleton.contract.yaml`, `src/main/dal/_app-settings-dal-contract-harness.ts`, `src/main/dal/app-settings-dal.contract.yaml`.

**Contract tests** (*.contract.yaml via test-contractor; harness files prefixed `_` live next to the subject; note test-contractor resolves subjects flat so non-callable/class subjects need a `_*-contract-harness.ts` adapter exposing callable wrappers — the deleted app-settings contracts are good templates, git show them if useful):
- Create `src/main/business/repo/settings-repo-singleton.contract.yaml` (+ harness if needed): singleton identity, fetch before init throws, fetch after init returns sanitized value, save updates fetched value and emits SETTINGS_SAVED (event bus is a singleton — assert via subscribe or reset appEventBusSingleton state between terms if it supports that; if untestable cleanly, cover save-then-fetch only and say so).
- Create `src/main/dal/settings-dal.contract.yaml` (+ harness): writeSettings then readSettings returns the value (memory), readSettings undefined before any write, readSettingsFile/writeSettings round-trip against a temp file path via the `settingsFilePath` constructor param (node fs tmp file), and writeSettings persists to the file.

## Project constraints (decided, beyond your skills' defaults)
- Repo layer speaks business words (load/save/fetch/init), dal speaks storage words (read/write); dal owns fs; repo holds no paths.
- Destructure params on the first body line (`const { settings } = params`), never `params.x` dot-reads in bodies.
- No constructor DI: protected field initializers only (`= new SettingsDal()` etc.); constructors take config values only.
- One dal per repo, IXxxDal interface declared in the repo file.

## Out of scope
Do not touch usage-snapshot / trigger-run-log repo+dal, the AppSettings model, life-cycle registration order, renderer code, or anything else that merely imports settings — only the files named above plus whatever breaks typecheck.

## Verification (run these, report real output)
`pnpm typecheck`, then `pnpm test:contract`, then `pnpm lint`. All must pass.

## Return
Files created/changed/deleted; the final public API of the merged repo and dal (method signatures); contract terms covered; the actual result lines of the three verification commands; anything you deliberately skipped or could not test cleanly.

---
- scheduling service (src/main/business/service/scheduling-service-singleton.ts) can fetch setting on its own, we dont need to pass it now
- check if other services also expect the settings to be passed by parameter, and fix them

---
- in ipc controller (src/main/controller/ipc-controller.ts) we are using rawRecord and have a primitive way od validating. use zod for validation of record in ipc.
- use a util validation wrappet from how we do in the @../visualiser/ project, check the common lib or common node lib i think you will find it there, or check the node core controllet handlers, we are using it there (src/main/controller/ipc-controller.ts)
- do the recomendation, use /orchestrating-ts-agents skill (src/main/dal/trigger-run-log-dal.ts, src/main/business/service/settings-service.ts, src/main/business/repo/usage-snapshot-repo.ts)

---
- if we finished migrating can we remove the legacy cide then, if we dont need it anymore (src/main/business/service/settings-service.ts)
- you can ignore this machine and settings
---
- remove the dummy provider for usage (@src/main/business/service/usage-provider/dummy.ts)
---
- go with schema folder (src/main/business/service/settings-service.ts)
---
- in settingsService (src/main/business/service/settings-service.ts) we have three almost identical functions, ensure unique id. make a util function out of it
---
- can we rethink how the setting code [src/main/business/service/settings-service.ts, src/main/business/repo/settings-repo-singleton.ts, src/main/business/use-case/settings-use-case.ts, src/shared/business/model/settings-model.ts] is structured. the idea is for the settings to be editable and fetch it and save to file, and to save it any time something changes. so we dont need service. the repo layer is enough the logic from the service layer for default settings can go in to the model constructor for the settings model
---
- we neet to merg settings model (@src/shared/business/model/settings-model.ts) and appsettngs model (@src/shared/business/model/app-settings-model.ts) into one settimgs model (@src/shared/business/model/settings-model.ts). the settings model must be a class
---
- in the @src/main/controller/ipc-controller.ts we can move all handler calls into single function register, they can still be grouped toghether and add comment as a title which is currently used for a function register name.
- move handlers into grouped files for update.ts put all handlers and on functions into file
- no, i ment to leave the part
ipcMain.handle(IpcChannelMapper.USAGE_REFRESH_TRACKER, 
in the register, and only move the handler, the callback function
- move @src/main/controller/ipc-controller.ts in @controller/ipc/ folder and call it router
---
- check all the singleton classes that we use by using singletonPattern, if the class doesn't need to be a singleton, if it has no memory that new instance will not have, then we can remove the singleton pattern. if you are not sure ask me (@src/main/business/repo/settings-repo-singleton.ts, @src/main/business/repo/trigger-run-log-repo-singleton.ts, @src/main/business/service/app-event-bus-singleton.ts, @src/main/business/service/scheduling-service-singleton.ts, @src/main/business/service/sessions-poll-service-singleton.ts, @src/main/business/service/sessions-service-singleton.ts, @src/main/business/service/ssh-sessions-service-singleton.ts, @src/main/business/service/update-service-singleton.ts, @src/main/business/service/usage-poll-service-singleton.ts, @src/main/controller/ipc/router.ts, @src/main/controller/rxjs-bus/router.ts, @src/main/lib/app-window-store-singleton.ts)
---
- rename @src/main/app-boot/usage-pulse-app-flow.ts into desktop-app.ts
---
- any code that has only to do with testing, except contract.ts and unit tests which must live next to the file, move them to the folder in the same level tha file exists __tests__
