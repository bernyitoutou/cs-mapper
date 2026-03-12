import { v } from "convex/values";

export enum Locale {
  EnGb = "en-GB",
  EnUs = "en-US",
  FrFr = "fr-FR",
  DeDe = "de-DE",
  EsEs = "es-ES",
  ItIt = "it-IT",
  JaJp = "ja-JP",
  ZhCn = "zh-CN",
}

export const localeValidator = v.union(
  v.literal(Locale.EnGb),
  v.literal(Locale.EnUs),
  v.literal(Locale.FrFr),
  v.literal(Locale.DeDe),
  v.literal(Locale.EsEs),
  v.literal(Locale.ItIt),
  v.literal(Locale.JaJp),
  v.literal(Locale.ZhCn)
);