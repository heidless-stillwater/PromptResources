'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true); // Baseline is premium Sapphire Dusk (dark mode)

    useEffect(() => {
        const savedTheme = localStorage.getItem('resources_theme');
        if (savedTheme === 'light') {
            setIsDarkMode(false);
            document.body.classList.add('light');
        } else {
            setIsDarkMode(true);
            document.body.classList.remove('light');
        }
    }, []);

    const toggleTheme = () => {
        setIsDarkMode((prev) => {
            const nextMode = !prev;
            if (nextMode) {
                document.body.classList.remove('light');
                localStorage.setItem('resources_theme', 'dark');
            } else {
                document.body.classList.add('light');
                localStorage.setItem('resources_theme', 'light');
            }
            return nextMode;
        });
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
