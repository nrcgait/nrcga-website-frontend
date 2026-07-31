import { STAKEHOLDER_GROUPS } from '../config/stakeholder-groups'
import { escapeHtml } from '../lib/admin-context'

export function MemberForm({
  member,
  error,
  readOnlyType = false,
}: {
  member?: Record<string, unknown>
  error?: string
  readOnlyType?: boolean
}) {
  const type = String(member?.type ?? 'Stakeholder')
  const isStakeholder = type === 'Stakeholder'
  const isOfficer = type === 'Officer'

  return (
    <form method="post" class="admin-form">
      {error ? <div class="error">{escapeHtml(error)}</div> : null}
      <label>Type</label>
      {readOnlyType ? (
        <>
          <input type="hidden" name="type" value={type} />
          <p>{type}</p>
        </>
      ) : (
        <select name="type" id="member-type-select">
          <option selected={type === 'Officer'}>Officer</option>
          <option selected={type === 'Stakeholder'}>Stakeholder</option>
          <option selected={type === 'Associate'}>Associate</option>
        </select>
      )}

      <label>Company name</label>
      <input name="company_name" required value={String(member?.company_name ?? '')} />

      {isOfficer ? (
        <>
          <OfficerPositionFields member={member} />
          <label>Term</label>
          <input name="term" value={String(member?.term ?? '')} placeholder="2025-2026" />
        </>
      ) : null}

      {isStakeholder ? (
        <>
          <label>Stakeholder group</label>
          <select name="stakeholder_group" required>
            <option value="">Select a group…</option>
            {STAKEHOLDER_GROUPS.map((group) => (
              <option selected={member?.stakeholder_group === group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              name="is_board_member"
              value="1"
              checked={member?.is_board_member === 1}
            />{' '}
            Board member for this stakeholder group
          </label>
          <p class="muted">
            Directors on the public site are derived from stakeholders marked as board members. Only one board member per
            group is allowed.
          </p>
          <OfficerPositionFields member={member} />
          <label>Term (for officers)</label>
          <input name="term" value={String(member?.term ?? '')} placeholder="2025-2026" />
        </>
      ) : null}

      {!isOfficer && !isStakeholder ? (
        <input type="hidden" name="stakeholder_group" value="" />
      ) : null}

      <label>Contact person</label>
      <input name="contact_person" value={String(member?.contact_person ?? '')} />
      <label>Website</label>
      <input name="website" value={String(member?.website ?? '')} />
      <label>
        <input type="checkbox" name="active" value="1" checked={member?.active !== 0} /> Active on public site
      </label>
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          Save
        </button>
        {member && !readOnlyType ? (
          <button class="btn btn-danger" name="_action" value="delete" type="submit">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  )
}

function OfficerPositionFields({ member }: { member?: Record<string, unknown> }) {
  return (
    <>
      <fieldset class="admin-fieldset">
        <legend>Officer positions</legend>
        <label>
          <input type="checkbox" name="is_chair" value="1" checked={member?.is_chair === 1} /> Chair
        </label>
        <label>
          <input type="checkbox" name="is_vice_chair" value="1" checked={member?.is_vice_chair === 1} /> Vice Chair
        </label>
        <p class="muted">Only one member can hold each officer position. Officers appear in the NRCGA Officers section on the public site.</p>
      </fieldset>
    </>
  )
}

export function UserForm({
  user,
  committees,
  stakeholderMembers,
  selectedCommittees,
  error,
}: {
  user?: {
    email: string
    role: string
    display_name: string | null
    member_id: string | null
  }
  committees: Array<{ slug: string; name: string }>
  stakeholderMembers: Array<{ id: string; company_name: string }>
  selectedCommittees: string[]
  error?: string
}) {
  const isEdit = Boolean(user)
  return (
    <form method="post" class="admin-form">
      {error ? <div class="error">{escapeHtml(error)}</div> : null}
      <label>Email</label>
      <input name="email" type="email" required value={user?.email ?? ''} />
      <label>Password{isEdit ? ' (leave blank to keep current)' : ''}</label>
      <input name="password" type="password" required={!isEdit} />
      <label>Display name</label>
      <input name="display_name" value={user?.display_name ?? ''} />
      <label>Role</label>
      <select name="role" data-user-role>
        <option value="user" selected={user?.role === 'user'}>
          User
        </option>
        <option value="trainer" selected={user?.role === 'trainer'}>
          Trainer
        </option>
        <option value="chair" selected={user?.role === 'chair'}>
          Committee Chair
        </option>
        <option value="admin" selected={user?.role === 'admin'}>
          Admin
        </option>
      </select>
      <div data-chair-fields hidden={user?.role !== 'chair'}>
        <label>Assigned committees</label>
        <CommitteePickerInline committees={committees} selectedSlugs={selectedCommittees} />
      </div>
      <label>Linked member organization (admin only)</label>
      <MemberOrgPickerInline members={stakeholderMembers} selectedId={user?.member_id ?? null} />
      <div class="admin-actions">
        <button class="btn btn-primary" type="submit">
          {isEdit ? 'Save user' : 'Create user'}
        </button>
        <a class="btn btn-secondary" href="/admin/users">
          Cancel
        </a>
      </div>
      <script src="/admin-forms.js"></script>
    </form>
  )
}

function CommitteePickerInline({
  committees,
  selectedSlugs,
}: {
  committees: Array<{ slug: string; name: string }>
  selectedSlugs: string[]
}) {
  const selected = new Set(selectedSlugs)
  return (
    <div class="committee-picker" data-committee-picker>
      <input type="hidden" name="committees" value={selectedSlugs.join(',')} data-committee-input />
      <button type="button" class="btn btn-secondary" data-committee-open>
        Select committees ({selectedSlugs.length})
      </button>
      <div class="committee-picker-selected">
        {selectedSlugs.length === 0 ? (
          <span class="muted">No committees selected</span>
        ) : (
          committees
            .filter((c) => selected.has(String(c.slug)))
            .map((c) => <span class="committee-tag">{c.name}</span>)
        )}
      </div>
      <dialog class="committee-picker-dialog" data-committee-dialog>
        <h3>Select committees</h3>
        <p class="muted">
          Committees are stored in the committees table (from committee enrollment data), not the programs list.
        </p>
        <div class="committee-picker-list">
          {committees.map((c) => (
            <label class="committee-picker-option">
              <input
                type="checkbox"
                value={String(c.slug)}
                checked={selected.has(String(c.slug))}
                data-committee-checkbox
              />
              {c.name}
              <span class="committee-slug">{String(c.slug)}</span>
            </label>
          ))}
        </div>
        <div class="admin-actions">
          <button type="button" class="btn btn-primary" data-committee-done>
            Done
          </button>
        </div>
      </dialog>
    </div>
  )
}

function MemberOrgPickerInline({
  members,
  selectedId,
}: {
  members: Array<{ id: string; company_name: string }>
  selectedId: string | null
}) {
  const selected = members.find((m) => m.id === selectedId)
  return (
    <div class="member-org-picker" data-member-org-picker>
      <input type="hidden" name="member_id" value={selectedId ?? ''} data-member-org-input />
      <button type="button" class="btn btn-secondary" data-member-org-open>
        {selected ? selected.company_name : 'Link to member organization'}
      </button>
      {selectedId ? (
        <button type="button" class="btn btn-secondary" data-member-org-clear>
          Clear
        </button>
      ) : null}
      <dialog class="committee-picker-dialog" data-member-org-dialog>
        <h3>Link user to member organization</h3>
        <input type="search" placeholder="Search companies…" data-member-org-search class="member-org-search" />
        <div class="committee-picker-list" data-member-org-list>
          {members.map((m) => (
            <button
              type="button"
              class={`member-org-option${m.id === selectedId ? ' selected' : ''}`}
              data-member-id={m.id}
              data-member-name={m.company_name}
            >
              {m.company_name}
            </button>
          ))}
        </div>
        <div class="admin-actions">
          <button type="button" class="btn btn-primary" data-member-org-done>
            Done
          </button>
        </div>
      </dialog>
    </div>
  )
}
