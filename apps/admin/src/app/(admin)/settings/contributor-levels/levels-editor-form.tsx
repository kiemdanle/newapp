'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { saveContributorLevelsAction } from '@/lib/actions';
import {
  DEFAULT_CONTRIBUTOR_LEVELS,
  EXPYRICO_BADGE_COLORS,
  type ContributorBadgeKey,
  type ContributorLevelTier,
  type ContributorLevelsSetting,
  type ExpyricoBadgeColorToken,
} from '@expyrico/shared';
import { AlertCircle, CheckCircle2, RotateCcw, Save } from 'lucide-react';

const BADGE_ICONS: readonly ContributorBadgeKey[] = [
  'seedling',
  'bronze_star',
  'silver_star',
  'gold_star',
  'emerald_gem',
  'sapphire_crown',
  'diamond_starburst',
] as const;

const PALETTE_TOKENS: readonly { token: ExpyricoBadgeColorToken; label: string; hex: string }[] = [
  { token: 'fresh_sage', label: 'Fresh Sage (#4BAE8A)', hex: EXPYRICO_BADGE_COLORS.fresh_sage },
  { token: 'deep_sage', label: 'Deep Sage (#3A8F6F)', hex: EXPYRICO_BADGE_COLORS.deep_sage },
  { token: 'mint_mist', label: 'Mint Mist (#D6F0E6)', hex: EXPYRICO_BADGE_COLORS.mint_mist },
  { token: 'honey', label: 'Honey (#F5A623)', hex: EXPYRICO_BADGE_COLORS.honey },
  { token: 'soft_butter', label: 'Soft Butter (#FEEFC3)', hex: EXPYRICO_BADGE_COLORS.soft_butter },
  { token: 'pebble', label: 'Pebble (#8C8C85)', hex: EXPYRICO_BADGE_COLORS.pebble },
  { token: 'almost_black', label: 'Almost Black (#2C2C28)', hex: EXPYRICO_BADGE_COLORS.almost_black },
] as const;

export function LevelsEditorForm({ initial }: { initial: ContributorLevelsSetting }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [enabled, setEnabled] = useState<boolean>(initial.enabled ?? true);
  const [levels, setLevels] = useState<ContributorLevelTier[]>(
    initial.levels && initial.levels.length === 10
      ? initial.levels
      : JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS)),
  );

  function updateTier<K extends keyof ContributorLevelTier>(
    index: number,
    field: K,
    val: ContributorLevelTier[K],
  ) {
    setLevels((prev) => {
      const next = [...prev];
      const target = next[index];
      if (target) {
        next[index] = { ...target, [field]: val };
      }
      return next;
    });
  }

  function handleReset() {
    if (confirm('Reset all 10 contributor levels to the recommended default values?')) {
      setLevels(JSON.parse(JSON.stringify(DEFAULT_CONTRIBUTOR_LEVELS)));
      setMsg('Restored recommended default tiers. Click "Save Changes" to apply.');
      setErr(null);
    }
  }

  function handleSave() {
    setErr(null);
    setMsg(null);

    // Client-side quick monotonicity check before hitting the server
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1];
      const curr = levels[i];
      if (prev && curr && curr.minPoints <= prev.minPoints) {
        setErr(
          `Level ${curr.level} points (${curr.minPoints}) must be strictly greater than Level ${prev.level} points (${prev.minPoints}).`,
        );
        return;
      }
    }

    startTransition(async () => {
      try {
        await saveContributorLevelsAction({ enabled, levels });
        setMsg('Contributor levels and settings saved successfully.');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Save failed');
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Master Enable/Disable Switch Card */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="space-y-0.5">
            <span className="text-base font-semibold text-neutral-dark">
              Enable Contributor Levels on Mobile Profiles
            </span>
            <p className="text-xs text-neutral-mid">
              When disabled, level hero cards, badges, and progress meters are hidden across the mobile app, but contribution history remains accessible.
            </p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-neutral-300 text-primary focus:ring-primary"
          />
        </label>
      </div>

      {/* 10-Tier Table Editor */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-dark">10 Contributor Tiers</h2>
            <p className="text-xs text-neutral-mid">
              Configure point thresholds, requirements, badge icons, and perks for each rank.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={pending}
            className="text-xs gap-1.5"
          >
            <RotateCcw size={14} />
            <span>Reset to Defaults</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-dark">
            <thead className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-mid uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4 w-44">Title</th>
                <th className="py-3 px-4 w-28">Products Req</th>
                <th className="py-3 px-4 w-28">Min Points</th>
                <th className="py-3 px-4 w-36">Badge Icon</th>
                <th className="py-3 px-4 w-44">Badge Color</th>
                <th className="py-3 px-4 min-w-[220px]">Perks / Rewards Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {levels.map((tier, idx) => {
                const colorInfo = PALETTE_TOKENS.find((p) => p.token === tier.colorToken) ?? PALETTE_TOKENS[0];
                return (
                  <tr key={tier.level} className="hover:bg-neutral-50/70 transition-colors">
                    <td className="py-3 px-4 text-center font-bold text-neutral-mid">
                      Lv {tier.level}
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={tier.title}
                        onChange={(e) => updateTier(idx, 'title', e.target.value)}
                        className="h-8 text-xs font-medium"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        type="number"
                        min="0"
                        value={tier.productsReq}
                        onChange={(e) =>
                          updateTier(idx, 'productsReq', parseInt(e.target.value || '0', 10))
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        type="number"
                        min="0"
                        value={tier.minPoints}
                        onChange={(e) =>
                          updateTier(idx, 'minPoints', parseInt(e.target.value || '0', 10))
                        }
                        className="h-8 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={tier.badgeKey}
                        onChange={(e) =>
                          updateTier(idx, 'badgeKey', e.target.value as ContributorBadgeKey)
                        }
                        className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {BADGE_ICONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: colorInfo?.hex }}
                        />
                        <select
                          value={tier.colorToken}
                          onChange={(e) =>
                            updateTier(idx, 'colorToken', e.target.value as ExpyricoBadgeColorToken)
                          }
                          className="h-8 w-full rounded-md border border-neutral-300 bg-white px-2 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {PALETTE_TOKENS.map((p) => (
                            <option key={p.token} value={p.token}>
                              {p.token}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Input
                        value={tier.perks}
                        onChange={(e) => updateTier(idx, 'perks', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Messages */}
      {err && (
        <div className="flex items-center gap-2 rounded-lg bg-[#FDE8E8] border border-[#E0442A]/30 p-3.5 text-xs text-[#E0442A] font-medium">
          <AlertCircle size={16} className="shrink-0" />
          <span>{err}</span>
        </div>
      )}

      {msg && (
        <div className="flex items-center gap-2 rounded-lg bg-[#D6F0E6] border border-[#4BAE8A]/30 p-3.5 text-xs text-[#3A8F6F] font-medium">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{msg}</span>
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="gap-2 px-6"
        >
          <Save size={16} />
          <span>{pending ? 'Saving...' : 'Save Changes'}</span>
        </Button>
      </div>
    </div>
  );
}
