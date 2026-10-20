'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import {
  fetchAllUsers,
  fetchAllRoles,
  createUser,
  updateUser,
  deleteUser,
  UserItem,
  UserRole,
} from '@/lib/api/users';

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  PE_JIG_FIXTURE: { label: 'Drafter', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  PE_SECTION_HEAD: { label: 'Section Head', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  PE_DEPT_HEAD: { label: 'Dept Head', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  TAMU: { label: 'Tamu', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

export default function AdminRbacPage() {
  const { user: currentUser } = useApp();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [form, setForm] = useState({
    name: '',
    npk: '',
    email: '',
    password: '',
    roleId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const load = async () => {
    setIsLoading(true);
    try {
      const [u, r] = await Promise.all([fetchAllUsers(), fetchAllRoles()]);
      setUsers(u);
      setRoles(r);
    } catch {
      notify('Gagal memuat data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.npk.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role?.name.toLowerCase().includes(q),
    );
  }, [users, search]);

  const openCreate = () => {
    setEditingUser(null);
    setForm({
      name: '',
      npk: '',
      email: '',
      password: '',
      roleId: roles[0]?.id || '',
    });
    setShowModal(true);
  };

  const openEdit = (u: UserItem) => {
    setEditingUser(u);
    setForm({
      name: u.name,
      npk: u.npk,
      email: u.email,
      password: '',
      roleId: u.roleId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.npk || !form.email || !form.roleId) return;

    setIsSubmitting(true);
    try {
      if (editingUser) {
        await updateUser(editingUser.id, {
          name: form.name.trim(),
          npk: form.npk.trim(),
          email: form.email.trim(),
          password: form.password?.trim() || undefined,
          roleId: form.roleId,
        });
        notify('Akun berhasil diperbarui.');
      } else {
        await createUser({
          name: form.name.trim(),
          npk: form.npk.trim(),
          email: form.email.trim(),
          password: form.password?.trim() || undefined,
          roleId: form.roleId,
        });
        notify('Akun baru berhasil ditambahkan.');
      }
      setShowModal(false);
      load();
    } catch (err: any) {
      notify(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus akun ini?')) return;
    try {
      await deleteUser(id);
      notify('Akun telah dihapus.');
      load();
    } catch (err: any) {
      notify(err.message || 'Gagal menghapus.');
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-3 space-y-2">
      {/* Toast */}
      {toast && (
        <div className="fixed top-3 right-3 z-50 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-semibold shadow-md">
          {toast}
        </div>
      )}

      {/* Top Bar (Full Width, Compact) */}
      <div className="w-full flex items-center justify-between gap-2 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-800">
            Manajemen Akun (RBAC)
          </span>
          <span className="text-[9px] bg-gray-100 text-gray-600 font-mono px-1.5 py-0.2 rounded font-bold">
            {users.length} akun
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Cari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-2 py-0.5 text-[10px] bg-gray-50 border border-gray-200 rounded-md w-36 focus:outline-none focus:border-[#0063ff]"
          />
          <button
            type="button"
            onClick={openCreate}
            className="h-6 px-2.5 bg-[#0063ff] hover:bg-[#0052d4] text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[13px]">add</span>
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Very Compact Table (Fit Width 100%) */}
      <div className="w-full bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-3xs">
        {isLoading ? (
          <div className="p-6 text-center text-[10px] text-gray-400">Memuat data...</div>
        ) : (
          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-gray-600 font-bold border-b border-gray-200 text-[8.5px] uppercase tracking-wider select-none h-6">
                <th className="px-2.5 py-1">Nama</th>
                <th className="px-2.5 py-1 w-24">NPK</th>
                <th className="px-2.5 py-1">Username / Email</th>
                <th className="px-2.5 py-1 w-32">Peran (Role)</th>
                <th className="px-2.5 py-1 text-right w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filtered.map((u) => {
                const roleInfo = ROLE_LABEL[u.role?.name] || {
                  label: u.role?.name || 'User',
                  color: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                const isSelf = currentUser?.id === u.id;

                return (
                  <tr key={u.id} className="hover:bg-blue-50/50 transition-colors h-7">
                    <td className="px-2.5 py-1 font-bold text-gray-800">
                      {u.name}
                      {isSelf && (
                        <span className="ml-1 text-[8px] font-bold text-blue-600 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                          Anda
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1 font-mono text-[9.5px] text-gray-600">{u.npk}</td>
                    <td className="px-2.5 py-1 font-mono text-[9.5px] text-gray-500">{u.email}</td>
                    <td className="px-2.5 py-1">
                      <span
                        className={`inline-block px-1.5 py-0.2 rounded text-[8.5px] font-bold border ${roleInfo.color}`}
                      >
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="p-0.5 text-gray-500 hover:text-blue-600 cursor-pointer"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u.id)}
                            className="p-0.5 text-gray-400 hover:text-rose-600 cursor-pointer"
                            title="Hapus"
                          >
                            <span className="material-symbols-outlined text-[13px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Add / Edit (Super Compact) */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xs bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
          >
            <div className="px-3 py-2 bg-slate-100 border-b border-gray-200 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-800">
                {editingUser ? 'Edit Akun' : 'Tambah Akun'}
              </span>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>

            <div className="p-3 space-y-2 text-[10px] text-gray-700">
              <div>
                <label className="block text-[8.5px] font-bold uppercase text-gray-500 mb-0.5">
                  Nama
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:border-[#0063ff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[8.5px] font-bold uppercase text-gray-500 mb-0.5">
                    NPK
                  </label>
                  <input
                    type="text"
                    required
                    value={form.npk}
                    onChange={(e) => setForm({ ...form, npk: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] font-mono focus:outline-none focus:border-[#0063ff]"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-bold uppercase text-gray-500 mb-0.5">
                    Username / Email
                  </label>
                  <input
                    type="text"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:border-[#0063ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold uppercase text-gray-500 mb-0.5">
                  Peran (Role)
                </label>
                <select
                  required
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] bg-white cursor-pointer focus:outline-none focus:border-[#0063ff]"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {ROLE_LABEL[r.name]?.label || r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[8.5px] font-bold uppercase text-gray-500 mb-0.5">
                  {editingUser ? 'Password Baru (Opsional)' : 'Password (Default: Sesuai NPK)'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingUser ? 'Kosongkan jika tak diubah' : 'Sama dengan NPK'}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] focus:outline-none focus:border-[#0063ff]"
                />
              </div>
            </div>

            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-150 flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-200 rounded transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-2.5 py-0.5 bg-[#0063ff] hover:bg-[#0052d4] text-white text-[10px] font-bold rounded transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? '...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
