import { Type } from './settings.js';

// This lists the preferences keys
export const KEYS = [
    {
        component: 'general', schemas: [
            { type: Type.I, name: 'hacks-level' },
            { type: Type.B, name: 'rounded-blur-found' },
            { type: Type.B, name: 'debug' },
        ]
    },
    {
        component: 'overview', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.I, name: 'style-components' },
        ]
    },
    {
        component: 'overlays', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.I, name: 'corner-radius' },
            { type: Type.D, name: 'refraction-strength' },
            { type: Type.I, name: 'refraction-radius' },
            { type: Type.I, name: 'refraction-inner-radius' },
            { type: Type.B, name: 'date-menu' },
            { type: Type.B, name: 'quick-settings' },
            { type: Type.B, name: 'notifications' },
            { type: Type.B, name: 'osd' },
            { type: Type.B, name: 'desktop-menus' },
            { type: Type.B, name: 'app-menus' },
        ]
    },
    {
        component: 'appfolder', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.I, name: 'style-dialogs' },
        ]
    },
    {
        component: 'panel', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.I, name: 'corner-radius' },
            { type: Type.B, name: 'unblur-in-overview' },
            { type: Type.B, name: 'force-light-text' },
            { type: Type.B, name: 'override-background' },
            { type: Type.I, name: 'style-panel' },
            { type: Type.B, name: 'override-background-dynamically' },
        ]
    },
    {
        component: 'dhruva', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.I, name: 'corner-radius' },
            { type: Type.D, name: 'refraction-strength' },
            { type: Type.I, name: 'refraction-radius' },
            { type: Type.I, name: 'refraction-inner-radius' },
        ]
    },
    {
        component: 'applications', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
            { type: Type.D, name: 'refraction-strength' },
            { type: Type.I, name: 'refraction-radius' },
            { type: Type.I, name: 'refraction-inner-radius' },
            { type: Type.I, name: 'corner-radius' },
            { type: Type.B, name: 'corner-when-maximized' },
            { type: Type.I, name: 'opacity' },
            { type: Type.B, name: 'dynamic-opacity' },
            { type: Type.B, name: 'blur-on-overview' },
            { type: Type.B, name: 'enable-all' },
            { type: Type.AS, name: 'whitelist' },
            { type: Type.AS, name: 'blacklist' },
        ]
    },
    {
        component: 'lockscreen', schemas: [
            { type: Type.B, name: 'blur' },
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.D, name: 'vibrancy' },
        ]
    },
    {
        component: 'hidetopbar', schemas: [
            { type: Type.B, name: 'compatibility' },
        ]
    },
    {
        component: 'dash-to-panel', schemas: [
            { type: Type.B, name: 'blur-original-panel' },
        ]
    },
];


// This lists the deprecated preferences keys
export const DEPRECATED_KEYS = [
    {
        component: 'general', schemas: [
            { type: Type.I, name: 'sigma' },
            { type: Type.D, name: 'brightness' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
            { type: Type.B, name: 'color-and-noise' },
        ]
    },
    {
        component: 'overview', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
    {
        component: 'appfolder', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
    {
        component: 'panel', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
    {
        component: 'dhruva', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
    {
        component: 'applications', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
    {
        component: 'lockscreen', schemas: [
            { type: Type.B, name: 'customize' },
            { type: Type.C, name: 'color' },
            { type: Type.D, name: 'noise-amount' },
            { type: Type.D, name: 'noise-lightness' },
        ]
    },
];
