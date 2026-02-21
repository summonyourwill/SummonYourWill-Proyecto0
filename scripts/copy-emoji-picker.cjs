const fs = require('fs-extra');
const path = require('path');

async function copyEmojiPicker() {
    try {
        console.log('📦 Copiando emoji-picker-element a assets/js...');
        
        const sourceDir = path.join(__dirname, '..', 'node_modules', 'emoji-picker-element');
        const targetDir = path.join(__dirname, '..', 'assets', 'js', 'emoji-picker-element');
        
        // Crear directorio de destino si no existe
        await fs.ensureDir(targetDir);
        
        // Archivos necesarios para el emoji picker
        const filesToCopy = [
            'index.js',
            'index.d.ts',
            'picker.js',
            'picker.d.ts',
            'database.js',
            'database.d.ts',
            'shared.d.ts',
            'custom-elements.json',
            'package.json'
        ];
        
        // Copiar archivos principales
        for (const file of filesToCopy) {
            const sourceFile = path.join(sourceDir, file);
            const targetFile = path.join(targetDir, file);
            
            if (await fs.pathExists(sourceFile)) {
                await fs.copy(sourceFile, targetFile);
                console.log(`✅ Copiado: ${file}`);
            } else {
                console.log(`⚠️ Archivo no encontrado: ${file}`);
            }
        }
        
        // Copiar directorio i18n completo
        const i18nSource = path.join(sourceDir, 'i18n');
        const i18nTarget = path.join(targetDir, 'i18n');
        
        if (await fs.pathExists(i18nSource)) {
            await fs.copy(i18nSource, i18nTarget);
            console.log('✅ Copiado directorio i18n');
        }
        
        console.log('🎉 Emoji picker copiado exitosamente a assets/js/emoji-picker-element/');
        
    } catch (error) {
        console.error('❌ Error copiando emoji picker:', error);
        process.exit(1);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    copyEmojiPicker();
}

module.exports = copyEmojiPicker;


