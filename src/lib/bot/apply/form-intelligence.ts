/**
 * Page-driven application filling: scan DOM → plan with LLM + knowledge bank → execute.
 * No ATS-specific branches; the model chooses actions from a stable ref list.
 */

import type { Locator, Page } from 'playwright-core'
import { AIClient } from '@/lib/ai/client'
import { getApplyAIConfig } from '@/lib/ai/config'
import type { ApplicationJobContext } from './knowledge-bank'
import { logApply, truncate } from './apply-log'
import { applyActionStepDelayMs, isUnsafeFullAutomation } from './automation-mode'

const MAX_CONTROLS = 100
export interface ScannedControl {
  ref: number
  tag: string
  inputType?: string
  /** Playwright-compatible selector when derivable; otherwise use roleName for buttons. */
  selector?: string | null
  /** For buttons without a reliable selector — match via getByRole('button', { name }). */
  roleName?: string | null
  labels: string
  placeholder?: string
  required?: boolean
  /** file | text | textarea | select | radio | checkbox | button | link | other */
  hint: string
  /** For <select> — value\tlabel lines, truncated */
  optionsPreview?: string
  currentValue?: string
}

export type PlannedAction =
  | { type: 'click'; ref: number; rationale?: string }
  | { type: 'fill'; ref: number; value: string; rationale?: string }
  | { type: 'select'; ref: number; valueOrLabel: string; rationale?: string }
  | { type: 'upload_resume'; ref: number; rationale?: string }

export interface FormPlan {
  reasoning?: string
  actions: PlannedAction[]
}

/**
 * OAuth / federated login the automation cannot complete — never plan or click these.
 */
export function isThirdPartyAuthControl(row: ScannedControl): boolean {
  const textBlob = `${row.roleName ?? ''} ${row.labels ?? ''} ${row.placeholder ?? ''}`.trim()
  const href = (row.currentValue ?? '').trim().toLowerCase()

  if (row.hint === 'link' && href.startsWith('http') && hrefIndicatesThirdPartyOAuth(href)) {
    return true
  }

  if (!textBlob && !href) return false

  const oauthPhrases = [
    /\bcontinue with\s+google\b/i,
    /\bcontinue with\s+apple\b/i,
    /\bcontinue with\s+facebook\b/i,
    /\bcontinue with\s+microsoft\b/i,
    /\bcontinue with\s+github\b/i,
    /\bcontinue with\s+linkedin\b/i,
    /\bsign in with\s+google\b/i,
    /\bsign in with\s+apple\b/i,
    /\bsign in with\s+facebook\b/i,
    /\bsign in with\s+microsoft\b/i,
    /\bsign in with\s+github\b/i,
    /\bsign in with\s+linkedin\b/i,
    /\blog in with\s+google\b/i,
    /\blog in with\s+apple\b/i,
    /\blogin with\s+google\b/i,
    /\blogin with\s+apple\b/i,
    /\bsign in using\s+google\b/i,
    /\bsign in using\s+apple\b/i,
    /\bsign up with\s+google\b/i,
    /\bsign up with\s+apple\b/i,
    /\buse google\b/i,
    /\buse apple\b/i,
    /\bauthenticate with\s+google\b/i,
    /\bauthenticate with\s+apple\b/i,
  ]
  if (oauthPhrases.some((re) => re.test(textBlob))) return true

  return false
}

function hrefIndicatesThirdPartyOAuth(href: string): boolean {
  const h = href.toLowerCase()
  return (
    h.includes('accounts.google.com') ||
    h.includes('google.com/o/oauth') ||
    h.includes('appleid.apple.com') ||
    /facebook\.com\/(v[\d.]+\/)?dialog\/oauth/.test(h) ||
    h.includes('login.microsoftonline.com') ||
    h.includes('github.com/login/oauth') ||
    h.includes('linkedin.com/oauth') ||
    h.includes('login.salesforce.com') ||
    h.includes('okta.com/oauth') ||
    h.includes('auth0.com/authorize') ||
    h.includes('cognito.amazonaws.com/oauth')
  )
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Collect visible application controls in stable DOM order with CSS selectors where possible.
 */
function scanIncludeSubmitControls(): boolean {
  return isUnsafeFullAutomation()
}

export async function scanApplicationPage(page: Page): Promise<ScannedControl[]> {
  const includeSubmit = scanIncludeSubmitControls()
  const raw = await page.evaluate(
    ({ max, includeSubmit: allowSubmit }) => {
    const out: Array<{
      tag: string
      inputType?: string
      selector?: string | null
      roleName?: string | null
      labels: string
      placeholder?: string
      required?: boolean
      hint: string
      optionsPreview?: string
      currentValue?: string
    }> = []

    function escAttr(s: string): string {
      return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    }

    function selectorFor(el: HTMLElement): string | null {
      if (el.id && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return `#${CSS.escape(el.id)}`
      }
      const name = el.getAttribute('name')
      const tag = el.tagName.toLowerCase()
      if (name && (tag === 'input' || tag === 'textarea' || tag === 'select')) {
        const t = (el as HTMLInputElement).type || 'text'
        if (t === 'radio' || t === 'checkbox') {
          const v = (el as HTMLInputElement).value ?? ''
          return `${tag}[type="${escAttr(t)}"][name="${escAttr(name)}"][value="${escAttr(v)}"]`
        }
        return `${tag}[name="${escAttr(name)}"]`
      }
      if (tag === 'button') {
        const dcy = el.getAttribute('data-cy')
        if (dcy) return `${tag}[data-cy="${escAttr(dcy)}"]`
        const dt = el.getAttribute('data-testid')
        if (dt) return `${tag}[data-testid="${escAttr(dt)}"]`
      }
      if (tag === 'a') {
        if (el.id && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
          return `a#${CSS.escape(el.id)}`
        }
        const dt = el.getAttribute('data-testid')
        if (dt) return `a[data-testid="${escAttr(dt)}"]`
        const dcy = el.getAttribute('data-cy')
        if (dcy) return `a[data-cy="${escAttr(dcy)}"]`
      }
      return null
    }

    function visible(el: HTMLElement): boolean {
      if (!el.isConnected) return false
      if ('disabled' in el && (el as HTMLInputElement).disabled) return false
      const st = window.getComputedStyle(el)
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false
      const r = el.getBoundingClientRect()
      if (r.width < 1 && r.height < 1) return false
      return true
    }

    function labelTextFor(el: HTMLElement): string {
      const id = el.id
      let s = ''
      if (id) {
        const lab = document.querySelector(`label[for="${escAttr(id)}"]`)
        if (lab) s += (lab.textContent || '').trim() + ' '
      }
      let p: HTMLElement | null = el.parentElement
      for (let d = 0; d < 4 && p; d++, p = p.parentElement) {
        if (p.tagName === 'LABEL') s += (p.textContent || '').trim() + ' '
      }
      const al = el.getAttribute('aria-label')
      if (al) s += al + ' '
      return s.replace(/\s+/g, ' ').trim()
    }

    const baseNodes = Array.from(
      document.querySelectorAll('input, textarea, select, button, a[href]')
    ) as HTMLElement[]
    const roleButtonNodes = Array.from(document.querySelectorAll('[role="button"]')).filter(
      (el): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false
        const t = el.tagName.toLowerCase()
        return t !== 'button' && t !== 'input' && t !== 'select' && t !== 'textarea' && t !== 'a'
      }
    ) as HTMLElement[]
    const nodes = [...baseNodes, ...roleButtonNodes]

    let linksAdded = 0
    const maxLinks = 55

    for (const el of nodes) {
      if (out.length >= max) break
      if (!visible(el)) continue

      const tag = el.tagName.toLowerCase()

      if (tag === 'a') {
        if (linksAdded >= maxLinks) continue
        const rawHref = (el.getAttribute('href') || '').trim()
        if (!rawHref || rawHref.startsWith('javascript:') || rawHref === '#') continue
        let resolvedHref = rawHref
        try {
          resolvedHref = new URL(rawHref, window.location.href).href
        } catch {
          /* keep raw */
        }
        if (resolvedHref.startsWith('javascript:')) continue
        const txt = `${(el.innerText || '').trim()} ${(el.getAttribute('aria-label') || '').trim()}`
          .trim()
          .replace(/\s+/g, ' ')
        if (txt.length < 2 && !el.getAttribute('data-testid') && !el.getAttribute('data-cy')) continue
        linksAdded++
        const sel = selectorFor(el)
        const rn = txt.slice(0, 120) || (el.getAttribute('aria-label') || '').trim().slice(0, 120) || null
        out.push({
          tag: 'a',
          selector: sel,
          roleName: rn,
          labels: labelTextFor(el).slice(0, 400),
          placeholder: undefined,
          required: false,
          hint: 'link',
          currentValue: resolvedHref.slice(0, 200),
        })
        continue
      }

      /** Many sites (e.g. Dice) use <div role="button"> for pill CTAs like "Continue with email". */
      const isRoleButton = el.getAttribute('role') === 'button' && tag !== 'button'
      if (isRoleButton) {
        const inner = (el.innerText || '').trim().replace(/\s+/g, ' ')
        const aria = (el.getAttribute('aria-label') || '').trim()
        const combined = `${inner} ${aria}`.trim().replace(/\s+/g, ' ')
        if (
          combined.length < 2 &&
          !el.getAttribute('data-cy') &&
          !el.getAttribute('data-testid')
        ) {
          continue
        }
        const sel = selectorFor(el)
        const roleName =
          combined.length >= 2
            ? combined.slice(0, 120)
            : (el.getAttribute('aria-label') || '').trim().slice(0, 120) || null
        out.push({
          tag,
          inputType: undefined,
          selector: sel,
          roleName,
          labels: labelTextFor(el).slice(0, 400),
          placeholder: undefined,
          required: el.getAttribute('aria-required') === 'true',
          hint: 'button',
          optionsPreview: undefined,
          currentValue: '',
        })
        continue
      }

      if (tag === 'input') {
        const t = (el as HTMLInputElement).type || 'text'
        if (t === 'hidden') continue
        if (!allowSubmit && (t === 'submit' || t === 'image')) continue
      }
      if (tag === 'button') {
        const t = (el as HTMLButtonElement).type
        if (!allowSubmit && t === 'submit') continue
        const txt = (el.innerText || '').trim().replace(/\s+/g, ' ')
        if (txt.length < 2 && !el.getAttribute('data-cy') && !el.getAttribute('data-testid')) continue
      }

      const inputType = tag === 'input' ? (el as HTMLInputElement).type : undefined
      let hint = 'other'
      if (tag === 'textarea') hint = 'textarea'
      else if (tag === 'select') hint = 'select'
      else if (tag === 'button') hint = 'button'
      else if (inputType === 'file') hint = 'file'
      else if (inputType === 'radio') hint = 'radio'
      else if (inputType === 'checkbox') hint = 'checkbox'
      else if (inputType === 'email' || inputType === 'tel' || inputType === 'url' || inputType === 'number' || inputType === 'text' || inputType === 'search' || !inputType)
        hint = 'text'

      let optionsPreview: string | undefined
      if (tag === 'select') {
        const opts = Array.from((el as HTMLSelectElement).options)
          .slice(0, 40)
          .map((o) => `${o.value}\t${(o.textContent || '').trim()}`)
          .join('\n')
        optionsPreview = opts.slice(0, 2000)
      }

      const sel = selectorFor(el)
      /** Visible label: innerText + aria-label so pills and icon CTAs stay identifiable. */
      let roleName: string | null = null
      if (tag === 'button') {
        const inner = (el.innerText || '').trim().replace(/\s+/g, ' ')
        const aria = (el.getAttribute('aria-label') || '').trim()
        const combined = `${inner} ${aria}`.trim().replace(/\s+/g, ' ')
        if (combined.length >= 2) {
          roleName = combined.slice(0, 120)
        }
      }

      const labels = labelTextFor(el)
      const placeholder = el.getAttribute('placeholder') || undefined
      const cur =
        tag === 'select'
          ? (el as HTMLSelectElement).value
          : tag === 'input' || tag === 'textarea'
            ? (el as HTMLInputElement).value
            : ''

      out.push({
        tag,
        inputType,
        selector: sel,
        roleName,
        labels: labels.slice(0, 400),
        placeholder: placeholder?.slice(0, 200),
        required: el.hasAttribute('required'),
        hint,
        optionsPreview,
        currentValue: String(cur).slice(0, 200),
      })
    }

    return out
  },
  { max: MAX_CONTROLS, includeSubmit }
  )

  return raw.map((r, i) => ({
    ref: i,
    tag: r.tag,
    inputType: r.inputType,
    selector: r.selector,
    roleName: r.roleName,
    labels: r.labels,
    placeholder: r.placeholder,
    required: r.required,
    hint: r.hint,
    optionsPreview: r.optionsPreview,
    currentValue: r.currentValue,
  }))
}

function planSchemaHint(): string {
  const finalizeRule = isUnsafeFullAutomation()
    ? `- **Full automation (unsafe — BROWSER_APPLY_UNSAFE_FULL_AUTOMATION=1):** When the form is truthful and complete for **this job**, you MAY click final **Submit / Send application / Apply** and account-creation **Sign up / Register / Create account** if that is clearly required to finish this application. Never affirm legal/background checks falsely.`
    : `- **Never finalize:** Do **not** click controls that **send the job application** or **finish brand-new account registration** — avoid final **Submit application**, **Send application**, **Send**, **type=submit** to the employer, and final **Sign up** / **Register** / **Create account** when that click would **complete** signup (not a mid-flow step).
- **Do** click obvious **step** controls on the same login/apply gate after you fill email/password: e.g. **Continue with email**, **Continue**, **Next**, **Log in**, **Sign in** — these advance the modal toward the real application and are **not** the forbidden finalizers above. If email is already filled, the next action is usually that continue button.
- **Never third-party auth:** Do **not** click **Continue with Google**, **Continue with Apple**, **Sign in with Google/Apple/Facebook/Microsoft/GitHub/LinkedIn**, or any control whose **href** or text sends the user to **Google / Apple / Microsoft / Facebook / GitHub / LinkedIn / OAuth** sign-in. The bot cannot complete those flows — use **email / password / magic-link** paths on the host site only.`

  return `Return a JSON object with keys:
- "reasoning" (optional string): brief plan.
- "actions" (array): ordered steps. Each action is ONE of:
  { "type": "click", "ref": <number>, "rationale": "<short>" }
  { "type": "fill", "ref": <number>, "value": "<string>", "rationale": "<short>" }
  { "type": "select", "ref": <number>, "valueOrLabel": "<option value or visible label>", "rationale": "<short>" }
  { "type": "upload_resume", "ref": <number>, "rationale": "<short>" }

Rules:
- Use only "ref" integers that appear in the provided scan list. Each row has "tag" (e.g. a, button, input) and "hint" (e.g. link, button, text).
- **Click ref must match buttonOrLinkText:** The **ref** on every **click** must be the row whose **buttonOrLinkText** is exactly the control you mean. **Continue with email** and **Continue with Google** / **Continue with Apple** are different sibling buttons — never output Google's ref when you intend the email path.
- **Forbidden clicks (hard):** Never output a **click** whose **buttonOrLinkText** or link **href** is **Google / Apple / Facebook / Microsoft / GitHub / LinkedIn OAuth** (e.g. Continue with Google, Sign in with Apple). Those steps are **omitted** — plan the **host-native** path only.
- **Never site chrome:** Do not click **Feedback**, **Cookie** / **Accept cookies**, **Newsletter**, **Subscribe**, or similar — they are not the application.
- **Unknown sites — improvise:** The scan mixes form controls with many **navigational links** (hint "link", tag "a"); **most links are site chrome** (footer, blog, other jobs), not this posting's apply flow. Prefer **click** steps only when text, aria-label, href, or **buttonOrLinkText** clearly advances **this job's** application path (Apply, Easy apply, Start application, Sign in to apply, **Continue with email**, Continue toward the form, etc.). Do **not** treat unrelated site search boxes as the application unless they clearly apply to this job.
- Order actions logically: **navigate / reveal** (clicks that open modals, expand sections, or go to the apply flow) **before** fills when the application UI is not yet visible.
- **Email gate (Dice-style):** If the scan already shows an **Email address** field **and** a **Continue with email** button, you are past the chrome opener — **fill email** then **click Continue with email**. Do **not** click **Login/Register** on that same screen (it toggles chrome / wrong path); it is not a substitute for **Continue with email**.
- Prefer clicks that reveal hidden fields (e.g. switch from file cover letter to text) before fills.
${finalizeRule}
- For empty text-like fields, supply concise accurate values from the knowledge bank (including name / email / phone and, when the knowledge bank includes a **portal signup** section, password fields **only** for obvious host-board account gates — never invent a password if none is provided).
- For file inputs that are clearly the CV/resume (not cover letter), use upload_resume once; do not put binary in "fill".
- For each radio row in the scan, "ref" points to that specific radio input; use "click" to choose it.
- Never use "fill" or "upload_resume" on rows with hint "link".
- Skip fields that already have a non-empty currentValue unless you must change them.
- Keep the action list reasonably short (typically under 40 steps).`
}

/**
 * After an email fill, models often pick Google/Apple instead of "Continue with email".
 * Rewrite to the email button when present; otherwise drop the OAuth click (never execute it).
 */
function fixMisassignedOAuthAfterEmailFill(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  const out: PlannedAction[] = []
  let afterEmailTextFill = false
  for (const a of actions) {
    if (a.type === 'fill') {
      const row = scan.find((c) => c.ref === a.ref)
      const lab = `${row?.labels ?? ''} ${row?.placeholder ?? ''}`
      afterEmailTextFill = Boolean(
        /@/.test(a.value) &&
          row &&
          (row.hint === 'text' || row.hint === 'textarea') &&
          /email|e-mail/i.test(lab)
      )
      out.push(a)
      continue
    }
    if (a.type === 'select' || a.type === 'upload_resume') {
      afterEmailTextFill = false
      out.push(a)
      continue
    }
    if (a.type === 'click' && afterEmailTextFill) {
      afterEmailTextFill = false
      const row = scan.find((c) => c.ref === a.ref)
      const text = (row?.roleName ?? '').trim()
      const emailBtn = findContinueWithEmailButton(scan)

      if (/continue with (google|apple)/i.test(text)) {
        if (emailBtn && emailBtn.ref !== a.ref) {
          logApply('plan_patch_email_continue', {
            fromRef: a.ref,
            toRef: emailBtn.ref,
            wrongLabel: truncate(text, 48),
          })
          out.push({ ...a, ref: emailBtn.ref })
          continue
        }
        if (!emailBtn) {
          logApply('plan_drop_oauth_after_email', { ref: a.ref, label: truncate(text, 48) })
          continue
        }
      }

      if (emailBtn && emailBtn.ref !== a.ref && isLoginRegisterish(row)) {
        logApply('plan_patch_login_register_to_email_continue', {
          fromRef: a.ref,
          toRef: emailBtn.ref,
          wrongLabel: truncate(text, 48),
        })
        out.push({ ...a, ref: emailBtn.ref })
        continue
      }

      out.push(a)
      continue
    }
    if (a.type === 'click') {
      afterEmailTextFill = false
    }
    out.push(a)
  }
  return out
}

/** Dice / similar: header "Login/Register" vs modal "Continue with email". */
function isLoginRegisterish(row: ScannedControl | undefined): boolean {
  if (!row || row.hint !== 'button') return false
  const t = `${row.roleName ?? ''} ${row.labels ?? ''}`.toLowerCase()
  if (/\blogin\s*\/\s*register\b/i.test(t)) return true
  if (/\blogin\/register\b/i.test(t)) return true
  if (t.includes('login') && t.includes('register')) return true
  return false
}

function controlTextBlob(c: ScannedControl): string {
  return `${c.roleName ?? ''} ${c.labels ?? ''} ${c.placeholder ?? ''}`.trim()
}

export function findContinueWithEmailButton(scan: ScannedControl[]): ScannedControl | undefined {
  return scan.find(
    (c) =>
      c.hint === 'button' &&
      /\bcontinue\s+with\s+e-?mail\b/i.test(controlTextBlob(c).toLowerCase())
  )
}

function findEmailGateField(scan: ScannedControl[]): ScannedControl | undefined {
  return scan.find(
    (c) =>
      (c.hint === 'text' || c.hint === 'textarea') &&
      (c.inputType === 'email' || /email|e-mail/i.test(`${c.labels} ${c.placeholder}`))
  )
}

function isSiteChromeNoiseClick(row: ScannedControl | undefined): boolean {
  if (!row) return false
  const b = controlTextBlob(row).toLowerCase()
  if (/\bfeedback\b/i.test(b) && !/apply|job|candidate/i.test(b)) return true
  if (/\bcookie(s)?\b/i.test(b) && /\b(accept|reject|manage|preference|settings)\b/i.test(b)) return true
  if (/\b(newsletter|subscribe)\b/i.test(b)) return true
  if (/\baccessibility\s+statement\b/i.test(b)) return true
  return false
}

function stripSiteChromeNoiseClicks(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  return actions.filter((a) => {
    if (a.type !== 'click') return true
    const row = scan.find((c) => c.ref === a.ref)
    if (!row || !isSiteChromeNoiseClick(row)) return true
    logApply('plan_drop_site_chrome_click', {
      ref: a.ref,
      text: truncate(controlTextBlob(row), 72),
    })
    return false
  })
}

/** Footer / legal "create an account" is not the Dice email gate — drop when the real email CTA is on screen. */
function stripDiceCreateAccountTeaserLink(
  actions: PlannedAction[],
  scan: ScannedControl[],
  job: ApplicationJobContext
): PlannedAction[] {
  if (!job.jobUrl?.toLowerCase().includes('dice.com')) return actions
  if (!findContinueWithEmailButton(scan)) return actions

  return actions.filter((a) => {
    if (a.type !== 'click') return true
    const row = scan.find((c) => c.ref === a.ref)
    if (!row || row.hint !== 'link') return true
    const t = (row.roleName ?? '').trim().toLowerCase()
    if (t === 'create an account' || /^create an account$/i.test(row.roleName?.trim() ?? '')) {
      logApply('plan_drop_dice_create_account_teaser', { ref: a.ref })
      return false
    }
    return true
  })
}

/**
 * On Dice, when the email gate is visible, ignore LLM noise and do fill + "Continue with email" only.
 */
function normalizeDiceEmailGatePlan(
  actions: PlannedAction[],
  scan: ScannedControl[],
  job: ApplicationJobContext
): PlannedAction[] {
  if (!job.jobUrl?.toLowerCase().includes('dice.com')) return actions

  const emailBtn = findContinueWithEmailButton(scan)
  const emailField = findEmailGateField(scan)
  if (!emailBtn || !emailField) return actions

  if (scan.some((c) => c.tag === 'input' && c.inputType === 'password')) {
    return actions
  }

  const fromPlan = actions.find((a) => a.type === 'fill' && /@/.test(a.value)) as
    | { type: 'fill'; value: string }
    | undefined
  const domVal = (emailField.currentValue ?? '').trim()
  const value =
    (job.applicationEmail?.trim() && job.applicationEmail.includes('@')
      ? job.applicationEmail.trim()
      : null) ||
    (fromPlan?.value && /@/.test(fromPlan.value) ? fromPlan.value : null) ||
    (domVal.includes('@') ? domVal : null)

  if (!value) return actions

  const needsFill = !domVal || domVal !== value
  const out: PlannedAction[] = []
  if (needsFill) {
    out.push({ type: 'fill', ref: emailField.ref, value, rationale: 'dice_email_gate' })
  }
  out.push({ type: 'click', ref: emailBtn.ref, rationale: 'dice_continue_with_email' })
  logApply('plan_force_dice_email_gate', {
    fill: needsFill,
    emailRef: emailField.ref,
    continueRef: emailBtn.ref,
  })
  return out
}

/** LLM sometimes outputs type "click" on text inputs ("focus") — invalid and shifts refs. */
function stripClicksOnFormFieldRows(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  return actions.filter((a) => {
    if (a.type !== 'click') return true
    const row = scan.find((c) => c.ref === a.ref)
    if (!row) return true
    if (['text', 'textarea', 'number', 'select', 'file'].includes(row.hint)) {
      logApply('plan_drop_click_on_form_field', { ref: a.ref, hint: row.hint })
      return false
    }
    return true
  })
}

function isPlannedEmailFill(a: PlannedAction, scan: ScannedControl[]): boolean {
  if (a.type !== 'fill') return false
  const row = scan.find((c) => c.ref === a.ref)
  const lab = `${row?.labels ?? ''} ${row?.placeholder ?? ''}`
  return Boolean(
    /@/.test(a.value) &&
      row &&
      (row.hint === 'text' || row.hint === 'textarea') &&
      /email|e-mail/i.test(lab)
  )
}

/**
 * When the modal already shows email + "Continue with email", opening Login/Register first is redundant
 * and often wrong — the model should fill then continue. Drop that leading click.
 */
function dropRedundantLoginRegisterBeforeEmailFill(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  if (!findContinueWithEmailButton(scan)) return actions

  const out: PlannedAction[] = []
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i]
    const next = actions[i + 1]
    if (
      a.type === 'click' &&
      next &&
      isPlannedEmailFill(next, scan) &&
      isLoginRegisterish(scan.find((c) => c.ref === a.ref))
    ) {
      logApply('plan_drop_login_register_before_email_fill', { ref: a.ref })
      continue
    }
    out.push(a)
  }
  return out
}

/**
 * When the email gate is visible (Continue with email in scan), never click Login/Register —
 * rewrite to Continue with email (covers plans that only toggle the header button).
 */
function rewriteLoginRegisterToEmailContinueWhenVisible(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  const emailBtn = findContinueWithEmailButton(scan)
  if (!emailBtn) return actions

  return actions.map((a) => {
    if (a.type !== 'click') return a
    if (a.ref === emailBtn.ref) return a
    const row = scan.find((c) => c.ref === a.ref)
    if (!isLoginRegisterish(row)) return a
    logApply('plan_rewrite_login_register_to_email_continue', { fromRef: a.ref, toRef: emailBtn.ref })
    return { ...a, ref: emailBtn.ref }
  })
}

/** Remove any planned click that targets third-party OAuth / federated login. */
function stripThirdPartyAuthClicks(actions: PlannedAction[], scan: ScannedControl[]): PlannedAction[] {
  return actions.filter((a) => {
    if (a.type !== 'click') return true
    const row = scan.find((c) => c.ref === a.ref)
    if (!row || !isThirdPartyAuthControl(row)) return true
    logApply('plan_drop_third_party_auth_click', {
      ref: a.ref,
      hint: row.hint,
      text: truncate(`${row.roleName ?? ''} ${row.labels}`.trim(), 96),
      href: row.hint === 'link' ? truncate(row.currentValue ?? '', 140) : undefined,
    })
    return false
  })
}

export async function planFormActions(
  scan: ScannedControl[],
  knowledgeBank: string,
  job: ApplicationJobContext
): Promise<FormPlan> {
  const ai = new AIClient(getApplyAIConfig())
  const scanJson = JSON.stringify(
    scan.map((c) => ({
      ref: c.ref,
      tag: c.tag,
      inputType: c.inputType,
      hint: c.hint,
      labels: c.labels,
      /** Visible text on buttons / links — use for planning clicks when labels is empty */
      buttonOrLinkText: c.roleName || undefined,
      placeholder: c.placeholder,
      required: c.required,
      currentValue: c.currentValue,
      /** For hint "link", often the resolved href (truncated) for disambiguation */
      optionsPreview: c.optionsPreview,
    })),
    null,
    0
  )

  const user = `${planSchemaHint()}

JOB: ${job.title} at ${job.company}

KNOWLEDGE BANK (candidate + policies):
${knowledgeBank}

SCANNED CONTROLS (ref is index; do not invent refs):
${scanJson}`

  const res = await ai.chatCompletion(
    [
      {
        role: 'system',
        content:
          'You are an expert at job application flows on arbitrary career sites (ATS, job boards, company portals). Output valid JSON only. Follow the user schema exactly. Never plan clicks on third-party OAuth (Google, Apple, Microsoft, Facebook, GitHub, LinkedIn SSO) — the automation cannot complete them. The scan can include navigational links (tag "a", hint "link") — treat them as valid click targets only when they advance the apply path without federated login.',
      },
      { role: 'user', content: user },
    ],
    { temperature: 0.2, responseFormat: 'json_object' }
  )

  let text = res.data.choices[0]?.message?.content?.trim() ?? '{}'
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/m, '')
  }
  let parsed: FormPlan
  try {
    parsed = JSON.parse(text) as FormPlan
  } catch {
    logApply('plan_parse_error', { preview: truncate(text, 160) })
    return { reasoning: 'parse_error', actions: [] }
  }
  if (!parsed.actions || !Array.isArray(parsed.actions)) {
    logApply('plan_no_actions_array', { reasoning: truncate(String(parsed.reasoning ?? ''), 120) })
    return { reasoning: 'no_actions', actions: [] }
  }

  const validRefs = new Set(scan.map((c) => c.ref))
  parsed.actions = parsed.actions.filter((a) => {
    if (!a || typeof a !== 'object') return false
    if (typeof (a as PlannedAction).ref !== 'number' || !validRefs.has((a as PlannedAction).ref)) return false
    const t = (a as PlannedAction).type
    if (t === 'fill') return typeof (a as { value?: unknown }).value === 'string'
    if (t === 'select') return typeof (a as { valueOrLabel?: unknown }).valueOrLabel === 'string'
    return t === 'click' || t === 'upload_resume'
  }) as PlannedAction[]

  parsed.actions = stripClicksOnFormFieldRows(parsed.actions, scan)
  parsed.actions = fixMisassignedOAuthAfterEmailFill(parsed.actions, scan)
  parsed.actions = stripThirdPartyAuthClicks(parsed.actions, scan)
  parsed.actions = dropRedundantLoginRegisterBeforeEmailFill(parsed.actions, scan)
  parsed.actions = rewriteLoginRegisterToEmailContinueWhenVisible(parsed.actions, scan)
  parsed.actions = stripSiteChromeNoiseClicks(parsed.actions, scan)
  parsed.actions = stripDiceCreateAccountTeaserLink(parsed.actions, scan, job)
  parsed.actions = normalizeDiceEmailGatePlan(parsed.actions, scan, job)

  if (parsed.actions.length === 0) {
    logApply('plan_empty_after_validation', {
      reasoning: parsed.reasoning ? truncate(parsed.reasoning, 200) : undefined,
    })
    return parsed
  }

  const actionSummary = parsed.actions.map((a, i) => {
    const row = scan.find((c) => c.ref === a.ref)
    const common: Record<string, unknown> = {
      step: i + 1,
      type: a.type,
      ref: a.ref,
      hint: row?.hint ?? null,
      labels: truncate(row?.labels ?? '', 72),
    }
    if (a.type === 'click') {
      common.rationale = a.rationale ? truncate(a.rationale, 120) : undefined
      common.buttonText = row?.roleName ? truncate(row.roleName, 60) : undefined
      common.targetTag = row?.tag ?? null
    }
    if (a.type === 'fill') {
      common.valueLen = a.value.length
      common.valuePreview = truncate(a.value, 56)
      common.rationale = a.rationale ? truncate(a.rationale, 80) : undefined
    }
    if (a.type === 'select') {
      common.valueOrLabel = truncate(a.valueOrLabel, 48)
      common.rationale = a.rationale ? truncate(a.rationale, 80) : undefined
    }
    if (a.type === 'upload_resume') {
      common.rationale = a.rationale ? truncate(a.rationale, 80) : undefined
    }
    return common
  })

  logApply('plan_ready', {
    actionCount: parsed.actions.length,
    reasoning: parsed.reasoning ? truncate(parsed.reasoning, 280) : undefined,
    actions: actionSummary,
  })

  return parsed
}

function rowForRef(scan: ScannedControl[], ref: number): ScannedControl | undefined {
  return scan.find((c) => c.ref === ref)
}

async function clickLocatorSafe(loc: Locator, clickMs: number): Promise<void> {
  await loc.scrollIntoViewIfNeeded().catch(() => {})
  try {
    await loc.click({ timeout: clickMs })
  } catch {
    await loc.click({ timeout: clickMs, force: true })
  }
}

/**
 * Execute a plan against the current page. Assumes DOM still matches scan (same URL).
 */
export async function executeFormPlan(
  page: Page,
  plan: FormPlan,
  scan: ScannedControl[],
  resumeFilePath: string | null
): Promise<{ ok: number; failed: number }> {
  let ok = 0
  let failed = 0

  logApply('execute_start', { totalActions: plan.actions.length })

  for (let i = 0; i < plan.actions.length; i++) {
    const action = plan.actions[i]
    const row = rowForRef(scan, action.ref)
    logApply('action_start', {
      index: i + 1,
      type: action.type,
      ref: action.ref,
      hint: row?.hint ?? null,
      labels: row ? truncate(row.labels, 64) : null,
    })

    try {
      if (!row) {
        failed++
        logApply('action_failed', { index: i + 1, type: action.type, ref: action.ref, reason: 'invalid_ref' })
        continue
      }

      if (action.type === 'click') {
        if (['text', 'textarea', 'number', 'select', 'file'].includes(row.hint ?? '')) {
          failed++
          logApply('action_blocked_click_on_form_field', {
            index: i + 1,
            ref: action.ref,
            hint: row.hint,
          })
          continue
        }
        if (isThirdPartyAuthControl(row)) {
          failed++
          logApply('action_blocked_third_party_auth', {
            index: i + 1,
            ref: action.ref,
            text: truncate(`${row.roleName ?? ''} ${row.labels}`.trim(), 96),
          })
          continue
        }
        if (isSiteChromeNoiseClick(row)) {
          failed++
          logApply('action_blocked_site_chrome', {
            index: i + 1,
            ref: action.ref,
            text: truncate(controlTextBlob(row), 72),
          })
          continue
        }
        const clickMs = 5000
        if (row.selector) {
          const loc = page.locator(row.selector).first()
          try {
            await clickLocatorSafe(loc, clickMs)
          } catch (e1) {
            if (row.roleName && row.hint === 'button') {
              const pat = new RegExp(escapeRegExp(row.roleName.slice(0, 60)), 'i')
              await clickLocatorSafe(page.getByRole('button', { name: pat }).first(), clickMs)
            } else {
              throw e1
            }
          }
        } else if (row.roleName) {
          const pat = new RegExp(escapeRegExp(row.roleName.slice(0, 60)), 'i')
          if (row.tag === 'a' || row.hint === 'link') {
            await clickLocatorSafe(page.getByRole('link', { name: pat }).first(), clickMs)
          } else {
            await clickLocatorSafe(page.getByRole('button', { name: pat }).first(), clickMs)
          }
        } else {
          failed++
          logApply('action_failed', { index: i + 1, type: 'click', ref: action.ref, reason: 'no_selector' })
          continue
        }
        await page.waitForTimeout(row.hint === 'link' || row.tag === 'a' ? 1200 : 500)
        ok++
        logApply('action_ok', { index: i + 1, type: 'click', ref: action.ref })
        continue
      }

      if (action.type === 'upload_resume') {
        if (!resumeFilePath || row.hint !== 'file') {
          failed++
          logApply('action_failed', {
            index: i + 1,
            type: 'upload_resume',
            ref: action.ref,
            reason: !resumeFilePath ? 'no_resume_file' : 'not_file_control',
          })
          continue
        }
        const lab = `${row.labels} ${row.placeholder ?? ''}`.toLowerCase()
        if (/cover\s*letter|coverletter/i.test(lab) && !/cv|resume|curriculum/i.test(lab)) {
          failed++
          logApply('action_failed', { index: i + 1, type: 'upload_resume', ref: action.ref, reason: 'cover_slot' })
          continue
        }
        if (row.selector) {
          await page.locator(row.selector).first().setInputFiles(resumeFilePath)
          ok++
          logApply('action_ok', { index: i + 1, type: 'upload_resume', ref: action.ref })
        } else {
          failed++
          logApply('action_failed', { index: i + 1, type: 'upload_resume', ref: action.ref, reason: 'no_selector' })
        }
        continue
      }

      if (action.type === 'fill') {
        if (row.hint === 'file' || row.hint === 'radio' || row.hint === 'link' || row.tag === 'a') {
          failed++
          logApply('action_failed', { index: i + 1, type: 'fill', ref: action.ref, reason: 'wrong_control_hint' })
          continue
        }
        if (row.selector) {
          const loc = page.locator(row.selector).first()
          await loc.fill(action.value, { timeout: 5000 })
          ok++
          logApply('action_ok', {
            index: i + 1,
            type: 'fill',
            ref: action.ref,
            valueLen: action.value.length,
            valuePreview: truncate(action.value, 40),
          })
        } else {
          failed++
          logApply('action_failed', { index: i + 1, type: 'fill', ref: action.ref, reason: 'no_selector' })
        }
        continue
      }

      if (action.type === 'select') {
        if (row.hint !== 'select' || !row.selector) {
          failed++
          logApply('action_failed', { index: i + 1, type: 'select', ref: action.ref, reason: 'not_select' })
          continue
        }
        const loc = page.locator(row.selector).first()
        await loc.selectOption({ label: action.valueOrLabel }, { timeout: 4000 }).catch(async () => {
          await loc.selectOption({ value: action.valueOrLabel }, { timeout: 4000 })
        })
        ok++
        logApply('action_ok', {
          index: i + 1,
          type: 'select',
          ref: action.ref,
          valueOrLabel: truncate(action.valueOrLabel, 48),
        })
        continue
      }

      failed++
      const unk = action as unknown as { type: string; ref: number }
      logApply('action_failed', {
        index: i + 1,
        ref: unk.ref,
        reason: 'unknown_action_type',
        type: unk.type,
      })
    } catch (e) {
      failed++
      logApply('action_failed', {
        index: i + 1,
        type: action.type,
        ref: action.ref,
        reason: 'exception',
        error: e instanceof Error ? truncate(e.message, 200) : String(e),
      })
    }

    const stepDelay = applyActionStepDelayMs()
    if (stepDelay > 0) {
      await page.waitForTimeout(stepDelay)
    }
  }

  logApply('execute_done', { ok, failed })
  return { ok, failed }
}

/**
 * Second pass: fill any still-empty text-like controls using per-field LLM (uses same apply model in field-filler).
 */
export async function sweepEmptyFieldsWithAI(
  page: Page,
  scan: ScannedControl[],
  fillOne: (label: string, type: 'text' | 'textarea' | 'number') => Promise<string | null>
): Promise<number> {
  let filled = 0
  let candidates = 0

  logApply('sweep_start', { scanControls: scan.length })

  for (const row of scan) {
    if (!['text', 'textarea', 'number'].includes(row.hint)) continue
    if (!row.selector) continue
    const loc = page.locator(row.selector).first()
    const vis = await loc.isVisible().catch(() => false)
    if (!vis) continue
    const val = ((await loc.inputValue().catch(() => '')) ?? '').trim()
    if (val) continue
    candidates++
    const label =
      [row.labels, row.placeholder].filter(Boolean).join(' — ').slice(0, 500) || `field ref ${row.ref}`
    const type = row.hint === 'textarea' ? 'textarea' : row.hint === 'number' ? 'number' : 'text'
    const answer = await fillOne(label, type).catch(() => null)
    if (answer) {
      await loc.fill(answer, { timeout: 5000 }).catch(() => {})
      filled++
      logApply('sweep_fill', {
        ref: row.ref,
        type,
        label: truncate(label, 96),
        answerLen: answer.length,
        answerPreview: truncate(answer, 48),
      })
    }
  }

  logApply('sweep_done', { emptyTextLikeCandidates: candidates, filled })
  return filled
}
