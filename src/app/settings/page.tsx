"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Volume2,
  Shield,
  Download,
  LogOut,
  Bell,
  Clock,
  Sparkles,
  Gift,
  CheckCircle2,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  BirthdayConfig,
  DEFAULT_BIRTHDAY_CONFIG,
  loadSavedBirthdayConfig,
  saveBirthdayConfig,
} from "@/lib/birthday";
import {
  getNotificationPermission,
  requestNotificationPermission,
  showLocalNotification,
  isPushNotificationSupported,
} from "@/lib/push-notifications";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function SettingsPage() {
  const [config, setConfig] = useState<BirthdayConfig>(DEFAULT_BIRTHDAY_CONFIG);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [supported, setSupported] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [volume, setVolume] = useState(80);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadSavedBirthdayConfig());
    setPermission(getNotificationPermission());
    setSupported(isPushNotificationSupported());
  }, []);

  const updateConfig = (key: keyof BirthdayConfig, val: any) => {
    const updated = { ...config, [key]: val };
    setConfig(updated);
    saveBirthdayConfig(updated);
    showToast("Settings updated ✨");
  };

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      showToast("Notifications enabled! You will receive birthday alerts ♡");
    } else if (result === "denied") {
      showToast("Notification permission was denied in your browser settings.");
    }
  };

  const handleSendTestNotification = () => {
    if (permission === "granted") {
      showLocalNotification("It's your special day! ♡", {
        body: `Another year, another chapter, and countless more memories waiting to be made. Happy Birthday, ${config.recipientName}! ✨`,
      });
      showToast("Test notification sent! Check your notification tray.");
    } else {
      showToast("In-app alert: Happy Birthday! (Browser push permission not yet granted).");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  return (
    <div className="space-y-10 animate-fade-in pb-16 max-w-3xl mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-plum text-cream text-xs font-medium shadow-float border border-white/20 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-butter" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="pb-6 border-b border-plum/10">
        <span className="text-[11px] font-semibold text-plum/50 uppercase tracking-widest block">
          Preferences & Space
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-plum">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-plum/70 font-sans mt-1">
          Manage your recurring birthday countdown, push notifications, and archive preferences.
        </p>
      </div>

      <div className="space-y-8">
        {/* ================================================================= */}
        {/* 1. DEDICATED BIRTHDAY & NOTIFICATIONS SECTION */}
        {/* ================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-paper space-y-6 relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-plum/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center text-plum shadow-sm">
                <Gift className="w-4 h-4 text-plum" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-plum">
                  Birthday &amp; Notifications
                </h3>
                <p className="text-xs text-plum/60 font-sans">
                  Configured for November 24 (repeating annually)
                </p>
              </div>
            </div>

            <span className="text-xs font-handwriting text-plum/70 bg-cream-300/80 px-2.5 py-1 rounded-full">
              Annual Recurrence
            </span>
          </div>

          <div className="space-y-5 text-sm">
            {/* Recipient Name */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium text-plum text-xs sm:text-sm">
                  Celebrant Name
                </p>
                <p className="text-[11px] text-plum/60">
                  Name featured in notifications and the birthday celebration.
                </p>
              </div>
              <input
                type="text"
                value={config.recipientName}
                onChange={(e) => updateConfig("recipientName", e.target.value)}
                className="px-3.5 py-1.5 rounded-xl bg-cream/70 border border-plum/15 text-xs text-plum font-medium w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-plum/20"
              />
            </div>

            {/* Floating Countdown Widget Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-plum/5">
              <div>
                <p className="font-medium text-plum text-xs sm:text-sm">
                  Floating Countdown Widget
                </p>
                <p className="text-[11px] text-plum/60">
                  Show the dreamy floating birthday countdown across all pages.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.widgetEnabled}
                onChange={(e) => updateConfig("widgetEnabled", e.target.checked)}
                className="w-4 h-4 accent-plum cursor-pointer"
              />
            </div>

            {/* Birthday Day Notifications */}
            <div className="flex items-center justify-between pt-2 border-t border-plum/5">
              <div>
                <p className="font-medium text-plum text-xs sm:text-sm">
                  Birthday Day Notification
                </p>
                <p className="text-[11px] text-plum/60">
                  Receive a warm notification on November 24 at your preferred time.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.birthdayNotifications}
                onChange={(e) => updateConfig("birthdayNotifications", e.target.checked)}
                className="w-4 h-4 accent-plum cursor-pointer"
              />
            </div>

            {/* Day Before Reminder */}
            <div className="flex items-center justify-between pt-2 border-t border-plum/5">
              <div>
                <p className="font-medium text-plum text-xs sm:text-sm">
                  Day-Before Reminder
                </p>
                <p className="text-[11px] text-plum/60">
                  Receive a gentle reminder on November 23 before the big day.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.dayBeforeReminder}
                onChange={(e) => updateConfig("dayBeforeReminder", e.target.checked)}
                className="w-4 h-4 accent-plum cursor-pointer"
              />
            </div>

            {/* Preferred Delivery Time & Timezone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-plum/5">
              <div>
                <label className="block text-[11px] font-semibold text-plum/70 mb-1 uppercase tracking-wider">
                  Delivery Time
                </label>
                <input
                  type="time"
                  value={config.deliveryTime}
                  onChange={(e) => updateConfig("deliveryTime", e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-cream/70 border border-plum/15 text-xs text-plum font-medium focus:outline-none focus:ring-2 focus:ring-plum/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-plum/70 mb-1 uppercase tracking-wider">
                  Configured Timezone
                </label>
                <select
                  value={config.timezone}
                  onChange={(e) => updateConfig("timezone", e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-cream/70 border border-plum/15 text-xs text-plum font-medium focus:outline-none focus:ring-2 focus:ring-plum/20"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notification Permission Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-cream/60 border border-plum/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-plum/70" />
                  <span className="font-serif font-bold text-xs sm:text-sm text-plum">
                    Browser Push Status
                  </span>
                </div>

                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    permission === "granted"
                      ? "bg-sage text-plum"
                      : permission === "denied"
                      ? "bg-red-100 text-red-700"
                      : "bg-butter text-plum"
                  }`}
                >
                  {permission === "granted"
                    ? "Active & Ready"
                    : permission === "denied"
                    ? "Blocked by Browser"
                    : "Not Yet Granted"}
                </span>
              </div>

              <p className="text-xs text-plum/70 leading-relaxed font-sans">
                Notifications allow House of Memories to wake up your phone or desktop on November 24 with a personalized greeting, even when the browser tab is closed.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {permission !== "granted" ? (
                  <button
                    onClick={handleRequestPermission}
                    className="px-4 py-2 rounded-xl bg-plum hover:bg-plum-light text-cream text-xs font-semibold shadow-sm transition-all"
                  >
                    Enable Birthday Notifications
                  </button>
                ) : (
                  <button
                    onClick={handleSendTestNotification}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-cream border border-plum/15 text-plum text-xs font-semibold shadow-sm transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Notification</span>
                  </button>
                )}

                <span className="text-[11px] text-plum/50 font-handwriting">
                  In-app celebration banner remains active as a permanent fallback ♡
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 2. AMBIENT SOUND PREFERENCES */}
        {/* ================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-paper space-y-5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-plum/60" />
            <h3 className="font-serif text-lg font-bold text-plum">
              Ambient Soundscapes
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-plum">
                  Enable Soundscapes
                </p>
                <p className="text-[11px] text-plum/60">
                  Play gentle acoustic background soundscapes while exploring.
                </p>
              </div>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 accent-plum cursor-pointer"
              />
            </div>

            {soundEnabled && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs text-plum/70">
                  <span>Volume</span>
                  <span>{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full accent-plum cursor-pointer"
                />
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. SPACE PRIVACY & ARCHIVE BACKUP */}
        {/* ================================================================= */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-plum/10 shadow-paper space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-plum/60" />
            <h3 className="font-serif text-lg font-bold text-plum">
              Space Identity &amp; Export
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-cream/50 border border-plum/10">
              <span className="text-plum/50 uppercase tracking-wider text-[10px] block mb-1">
                Space Members
              </span>
              <span className="font-semibold text-plum text-sm">
                Alex &amp; Maya (2 Members)
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-cream/50 border border-plum/10">
              <span className="text-plum/50 uppercase tracking-wider text-[10px] block mb-1">
                Security Model
              </span>
              <span className="font-semibold text-plum text-sm">
                Private RLS · End-to-End
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button className="px-4 py-2.5 rounded-xl border border-plum/15 text-xs font-semibold text-plum hover:bg-cream transition-all flex items-center gap-2">
              <Download className="w-3.5 h-3.5" />
              <span>Export Offline Archive (.zip)</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
