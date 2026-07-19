import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Backpack, Check, Coins, Loader2, PackageOpen, RefreshCw, Shield, ShoppingBag, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Character } from '../types';
import type { EquipmentSlot, InventoryData, InventoryItem, MerchantData } from '../game/types';
import { ITEM_BY_ID } from '../game/items';
import {
  EQUIPMENT_SLOTS, addInventoryItem, assignQuickSlot, buyPrice, createInventoryItem, equipInventoryItem,
  equippedItemNames, generateMerchant, getItemDefinition, inventorySlotsUsed, normalizeInventory,
  removeInventoryItem, sellPrice, unequipSlot,
} from '../game/inventory';

interface InventoryPanelProps {
  character: Character;
  campaignId?: string;
  currentUserId?: string;
  location?: string;
  sceneNumber?: number;
  canTrade?: boolean;
  onSave: (character: Character) => void | Promise<void>;
  onClose: () => void;
}

interface StashRow { id: string; item_data: InventoryItem; added_by: string; }
type Tab = 'inventory' | 'trade' | 'stash';

const SLOT_LABELS: Record<EquipmentSlot, string> = { mainHand: 'Основная рука', offHand: 'Вторая рука', armor: 'Броня', accessory1: 'Аксессуар I', accessory2: 'Аксессуар II' };
const RARITY_CLASS = { common: 'text-zinc-400', uncommon: 'text-emerald-400', rare: 'text-sky-400', epic: 'text-violet-400' };
const RARITY_LABEL = { common: 'Обычный', uncommon: 'Необычный', rare: 'Редкий', epic: 'Эпический' };

export default function InventoryPanel({ character, campaignId, currentUserId = 'local', location = 'перекрёстка', sceneNumber = 1, canTrade = false, onSave, onClose }: InventoryPanelProps) {
  const [inventory, setInventory] = useState<InventoryData>(() => normalizeInventory(character));
  const [gold, setGold] = useState(character.gold || 0);
  const [tab, setTab] = useState<Tab>('inventory');
  const [merchant, setMerchant] = useState<MerchantData>(() => generateMerchant(location, sceneNumber));
  const [stash, setStash] = useState<StashRow[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const slotsUsed = inventorySlotsUsed(inventory);

  const loadMerchant = useCallback(async () => {
    if (!campaignId || !canTrade) return;
    const generated = generateMerchant(location, sceneNumber);
    const { data, error: loadError } = await supabase.from('campaign_merchants').select('*').eq('campaign_id', campaignId).eq('merchant_key', generated.key).maybeSingle();
    if (loadError) { setNotice('Торговец работает локально. Для синхронизации примените обновлённую миграцию.'); return; }
    if (data) {
      setMerchant({ key: data.merchant_key, name: data.name, stock: data.stock, buyModifier: Number(data.buy_modifier), sellModifier: Number(data.sell_modifier) });
      return;
    }
    const { error: createError } = await supabase.from('campaign_merchants').insert({ campaign_id: campaignId, merchant_key: generated.key, name: generated.name, stock: generated.stock, buy_modifier: generated.buyModifier, sell_modifier: generated.sellModifier });
    if (createError) setNotice('Ассортимент не синхронизирован с другими игроками.');
  }, [campaignId, canTrade, location, sceneNumber]);

  const loadStash = useCallback(async () => {
    if (!campaignId) return;
    const { data, error: loadError } = await supabase.from('campaign_stash_items').select('id, item_data, added_by').eq('campaign_id', campaignId).order('created_at');
    if (loadError) { setNotice('Общий сундук появится после применения обновлённой миграции.'); return; }
    setStash((data || []) as StashRow[]);
  }, [campaignId]);

  useEffect(() => { void loadMerchant(); void loadStash(); }, [loadMerchant, loadStash]);
  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase.channel(`stash-ui:${campaignId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_stash_items', filter: `campaign_id=eq.${campaignId}` }, () => void loadStash()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [campaignId, loadStash]);

  async function commit(nextInventory: InventoryData, nextGold = gold) {
    const updated: Character = { ...character, inventory_data: nextInventory, equipment: equippedItemNames(nextInventory), gold: nextGold };
    await onSave(updated);
    setInventory(nextInventory); setGold(nextGold);
  }

  async function run(key: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(key); setError(''); setNotice('');
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Операция не выполнена'); }
    finally { setBusy(''); }
  }

  async function equip(item: InventoryItem, slot: EquipmentSlot) {
    await run(`equip:${item.uid}`, async () => {
      const result = equipInventoryItem(inventory, item.uid, slot);
      if (result.error) throw new Error(result.error);
      await commit(result.inventory);
    });
  }

  async function unequip(slot: EquipmentSlot) {
    await run(`slot:${slot}`, () => commit(unequipSlot(inventory, slot)));
  }

  async function toggleQuick(item: InventoryItem) {
    await run(`quick:${item.uid}`, async () => {
      const existing = inventory.quickSlots.indexOf(item.uid);
      const target = existing >= 0 ? existing : inventory.quickSlots.findIndex(value => value === null);
      if (target < 0) throw new Error('Все быстрые слоты заняты');
      await commit(assignQuickSlot(inventory, existing >= 0 ? null : item.uid, target));
    });
  }

  async function updateMerchant(next: MerchantData) {
    setMerchant(next);
    if (!campaignId) return;
    const { error: updateError } = await supabase.from('campaign_merchants').update({ stock: next.stock, updated_at: new Date().toISOString() }).eq('campaign_id', campaignId).eq('merchant_key', next.key);
    if (updateError) setNotice('Сделка сохранена у героя, но запас торговца пока локальный.');
  }

  async function buy(templateId: string) {
    await run(`buy:${templateId}`, async () => {
      const stock = merchant.stock.find(item => item.templateId === templateId);
      const definition = ITEM_BY_ID.get(templateId);
      if (!stock || !definition || stock.quantity <= 0) throw new Error('Предмет закончился');
      const price = buyPrice(definition, merchant, stock.priceModifier);
      if (gold < price) throw new Error('Недостаточно золота');
      const added = addInventoryItem(inventory, createInventoryItem(templateId));
      if (added.error) throw new Error(added.error);
      const nextMerchant = { ...merchant, stock: merchant.stock.map(item => item.templateId === templateId ? { ...item, quantity: item.quantity - 1 } : item) };
      await commit(added.inventory, gold - price);
      await updateMerchant(nextMerchant);
      setNotice(`Куплено: ${definition.name}`);
    });
  }

  async function sell(item: InventoryItem) {
    await run(`sell:${item.uid}`, async () => {
      const definition = getItemDefinition(item);
      if (!definition || definition.type === 'quest') throw new Error('Этот предмет нельзя продать');
      if (Object.values(inventory.equipped).includes(item.uid)) throw new Error('Сначала снимите предмет');
      const price = sellPrice(definition, merchant);
      const nextInventory = removeInventoryItem(inventory, item.uid, 1);
      const stockEntry = merchant.stock.find(entry => entry.templateId === definition.id);
      const nextStock = stockEntry
        ? merchant.stock.map(entry => entry.templateId === definition.id ? { ...entry, quantity: entry.quantity + 1 } : entry)
        : [...merchant.stock, { templateId: definition.id, quantity: 1, priceModifier: 1 }];
      await commit(nextInventory, gold + price);
      await updateMerchant({ ...merchant, stock: nextStock });
      setNotice(`Продано: ${definition.name}`);
    });
  }

  async function deposit(item: InventoryItem) {
    if (!campaignId) return;
    await run(`deposit:${item.uid}`, async () => {
      if (Object.values(inventory.equipped).includes(item.uid)) throw new Error('Сначала снимите предмет');
      const definition = getItemDefinition(item);
      if (definition?.type === 'quest') throw new Error('Сюжетные предметы уже принадлежат всей группе');
      const { data, error: insertError } = await supabase.from('campaign_stash_items').insert({ campaign_id: campaignId, item_data: item, added_by: currentUserId }).select('id, item_data, added_by').single();
      if (insertError) throw new Error('Не удалось положить предмет. Примените обновлённую миграцию.');
      await commit(removeInventoryItem(inventory, item.uid, item.quantity));
      setStash(previous => [...previous, data as StashRow]);
    });
  }

  async function take(row: StashRow) {
    if (!campaignId) return;
    await run(`take:${row.id}`, async () => {
      const added = addInventoryItem(inventory, { ...row.item_data, uid: globalThis.crypto?.randomUUID?.() || `${row.item_data.uid}_taken` });
      if (added.error) throw new Error(added.error);
      const { error: deleteError } = await supabase.from('campaign_stash_items').delete().eq('id', row.id);
      if (deleteError) throw new Error('Предмет уже забрал другой игрок');
      try { await commit(added.inventory); }
      catch (caught) {
        await supabase.from('campaign_stash_items').insert({ campaign_id: campaignId, item_data: row.item_data, added_by: row.added_by });
        throw caught;
      }
      setStash(previous => previous.filter(item => item.id !== row.id));
    });
  }

  const equippedItems = useMemo(() => Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, inventory.items.find(item => item.uid === inventory.equipped[slot])])), [inventory]);

  return <div className="fixed inset-0 z-[90] bg-[#09090b] text-zinc-100 overflow-y-auto">
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3"><div className="max-w-6xl mx-auto flex items-center justify-between gap-3"><div className="flex items-center gap-3 min-w-0"><button onClick={onClose} className="shrink-0 p-2.5 rounded-xl border border-zinc-800"><ArrowLeft className="w-4 h-4"/></button><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.2em] text-amber-500">Снаряжение героя</p><h1 className="font-black truncate">{character.name}</h1></div></div><div className="flex items-center gap-2 text-amber-300 font-mono"><Coins className="w-4 h-4"/>{gold}</div></div></header>
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <TabButton active={tab === 'inventory'} onClick={() => setTab('inventory')} icon={<Backpack/>} label="Рюкзак"/>
        <TabButton active={tab === 'trade'} disabled={!canTrade} onClick={() => setTab('trade')} icon={<ShoppingBag/>} label="Торговля"/>
        <TabButton active={tab === 'stash'} disabled={!campaignId} onClick={() => setTab('stash')} icon={<Users/>} label="Сундук"/>
      </div>
      {error && <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>}
      {notice && <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">{notice}</div>}

      {tab === 'inventory' && <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <aside className="space-y-3"><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><div className="flex justify-between"><strong>Экипировка</strong><Shield className="w-4 h-4 text-zinc-600"/></div><div className="mt-3 space-y-2">{EQUIPMENT_SLOTS.map(slot => { const item = equippedItems[slot] as InventoryItem | undefined; return <button key={slot} disabled={!item || Boolean(busy)} onClick={() => item && void unequip(slot)} className="w-full min-h-14 p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-left disabled:opacity-100"><span className="block text-[10px] uppercase text-zinc-600">{SLOT_LABELS[slot]}</span><span className={item ? 'text-sm text-zinc-200' : 'text-sm text-zinc-700'}>{item?.name || 'Пусто'}</span></button>; })}</div></div><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><div className="flex justify-between text-xs"><span>Рюкзак</span><span className={slotsUsed > inventory.capacity ? 'text-red-400' : 'text-zinc-500'}>{slotsUsed}/{inventory.capacity}</span></div><div className="h-2 rounded bg-zinc-800 mt-2"><div className="h-full bg-amber-500 rounded" style={{ width: `${Math.min(100, slotsUsed / inventory.capacity * 100)}%` }}/></div><p className="text-[10px] text-zinc-600 mt-3">Быстрые слоты: {inventory.quickSlots.map((value, index) => inventory.items.find(item => item.uid === value)?.name || `№${index + 1}`).join(' · ')}</p></div></aside>
        <section><div className="flex justify-between items-end mb-3"><div><p className="text-xs uppercase text-zinc-600">Содержимое</p><h2 className="text-xl font-bold">Предметы</h2></div><span className="text-xs text-zinc-600">{inventory.items.length}</span></div>{inventory.items.length ? <div className="grid sm:grid-cols-2 gap-3">{inventory.items.map(item => <ItemCard key={item.uid} item={item} busy={busy === `equip:${item.uid}` || busy === `quick:${item.uid}`} equipped={Object.values(inventory.equipped).includes(item.uid)} quick={inventory.quickSlots.includes(item.uid)} onEquip={slot => void equip(item, slot)} onQuick={() => void toggleQuick(item)} onDeposit={campaignId ? () => void deposit(item) : undefined}/>)}</div> : <Empty text="Рюкзак пуст"/>}</section>
      </div>}

      {tab === 'trade' && <div className="grid lg:grid-cols-2 gap-5"><section><p className="text-xs uppercase text-amber-500">{merchant.name}</p><h2 className="text-2xl font-black mt-1">Купить</h2><div className="mt-4 space-y-2">{merchant.stock.filter(stock => stock.quantity > 0).map(stock => { const definition = ITEM_BY_ID.get(stock.templateId); if (!definition) return null; const price = buyPrice(definition, merchant, stock.priceModifier); return <div key={stock.templateId} className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex gap-3"><span className="text-2xl">{definition.icon}</span><div className="flex-1"><div className="flex justify-between gap-2"><strong>{definition.name}</strong><span className="text-xs text-zinc-500">×{stock.quantity}</span></div><p className="text-xs text-zinc-500 mt-1">{definition.description}</p><button disabled={Boolean(busy) || gold < price} onClick={() => void buy(definition.id)} className="mt-3 px-3 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold disabled:opacity-30">Купить · {price} зол.</button></div></div>; })}</div></section><section><p className="text-xs uppercase text-zinc-600">Ваш рюкзак</p><h2 className="text-2xl font-black mt-1">Продать</h2><div className="mt-4 space-y-2">{inventory.items.map(item => { const definition = getItemDefinition(item); const price = definition ? sellPrice(definition, merchant) : 0; const blocked = !definition || definition.type === 'quest' || Object.values(inventory.equipped).includes(item.uid); return <div key={item.uid} className="p-3 rounded-xl border border-zinc-800 flex justify-between items-center gap-3"><div><strong className="text-sm">{item.name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</strong><p className="text-[10px] text-zinc-600">{blocked ? 'Нельзя продать' : `${price} золота за один`}</p></div><button disabled={Boolean(busy) || blocked} onClick={() => void sell(item)} className="px-3 py-2 rounded-lg bg-zinc-800 text-xs disabled:opacity-30">Продать</button></div>; })}</div></section></div>}

      {tab === 'stash' && <div className="grid lg:grid-cols-2 gap-5"><section><p className="text-xs uppercase text-zinc-600">Общий запас</p><h2 className="text-2xl font-black mt-1">Сундук партии</h2><p className="text-sm text-zinc-500 mt-2">Все участники видят изменения сразу.</p><div className="mt-4 space-y-2">{stash.length ? stash.map(row => <div key={row.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 flex justify-between items-center"><div><strong className="text-sm">{row.item_data.name}</strong><p className="text-[10px] text-zinc-600">Количество: {row.item_data.quantity}</p></div><button disabled={Boolean(busy)} onClick={() => void take(row)} className="px-3 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-bold">Забрать</button></div>) : <Empty text="Сундук пуст"/>}</div></section><section><p className="text-xs uppercase text-zinc-600">Как положить</p><h2 className="text-xl font-bold mt-1">Из рюкзака</h2><p className="text-sm text-zinc-500 mt-2">Перейдите в «Рюкзак» и нажмите «В сундук» на нужном предмете.</p></section></div>}
    </div>
  </div>;
}

function TabButton({ active, disabled, onClick, icon, label }: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button disabled={disabled} onClick={onClick} className={`min-h-12 rounded-xl border flex items-center justify-center gap-2 text-xs sm:text-sm font-bold ${active ? 'border-amber-400 bg-amber-500/10 text-amber-300' : 'border-zinc-800 bg-zinc-900/60 text-zinc-500'} disabled:opacity-30`}>{<span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>}{label}</button>;
}

function ItemCard({ item, busy, equipped, quick, onEquip, onQuick, onDeposit }: { item: InventoryItem; busy: boolean; equipped: boolean; quick: boolean; onEquip: (slot: EquipmentSlot) => void; onQuick: () => void; onDeposit?: () => void }) {
  const definition = getItemDefinition(item);
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"><div className="flex gap-3"><span className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center text-xl shrink-0">{definition?.icon || <PackageOpen className="w-5 h-5"/>}</span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="truncate">{item.name}</strong>{item.quantity > 1 && <span className="text-xs text-zinc-500">×{item.quantity}</span>}</div>{definition && <p className={`text-[10px] uppercase ${RARITY_CLASS[definition.rarity]}`}>{RARITY_LABEL[definition.rarity]} · {definition.type}</p>}<p className="text-xs text-zinc-500 mt-2">{item.customDescription || definition?.description || 'Предмет из старой версии героя.'}</p></div></div><div className="flex flex-wrap gap-2 mt-4">{definition?.equipSlots?.map(slot => <button key={slot} disabled={busy || equipped} onClick={() => onEquip(slot)} className="px-3 py-2 rounded-lg bg-zinc-800 text-[11px] disabled:opacity-30">{equipped ? <span className="flex gap-1"><Check className="w-3 h-3"/>Надето</span> : SLOT_LABELS[slot]}</button>)}{definition?.type === 'consumable' && <button disabled={busy} onClick={onQuick} className={`px-3 py-2 rounded-lg text-[11px] ${quick ? 'bg-emerald-500/15 text-emerald-300' : 'bg-zinc-800'}`}>{quick ? 'В быстром слоте' : 'В быстрый слот'}</button>}{onDeposit && <button disabled={busy || equipped} onClick={onDeposit} className="px-3 py-2 rounded-lg bg-zinc-800 text-[11px] disabled:opacity-30">В сундук</button>}{busy && <Loader2 className="w-4 h-4 animate-spin text-amber-400"/>}</div></article>;
}

function Empty({ text }: { text: string }) { return <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center text-zinc-600"><RefreshCw className="w-5 h-5 mx-auto mb-2"/>{text}</div>; }
