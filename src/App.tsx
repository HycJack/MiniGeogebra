/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GeometryCanvas } from './components/GeometryCanvas';
import { LanguageProvider } from './i18n/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <div className="w-full h-full">
        <GeometryCanvas />
      </div>
    </LanguageProvider>
  );
}
