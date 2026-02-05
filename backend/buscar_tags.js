const fs = require('fs');
const https = require('https');
try {
    const env = fs.readFileSync('.env', 'utf8');
    // Buscamos la Key
    const match = env.match(/MC_API_KEY=(.*)/);
    if (!match) throw new Error('❌ No encontre MC_API_KEY en el archivo .env');
    
    // Limpiamos la key
    const key = match[1].trim().replace(/['"]+/g, '');
    console.log('✅ API Key encontrada: ' + key.substring(0,5) + '...');

    // Peticion a ManyChat
    https.get('https://api.manychat.com/fb/page/getTags', {
        headers: { 
            'Authorization': 'Bearer ' + key,
            'Content-Type': 'application/json'
        }
    }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.status === 'success') {
                    console.log('\n🔥 --- LISTA DE TUS ETIQUETAS --- 🔥\n');
                    json.data.forEach(t => {
                        console.log(`Nombre: "${t.name}"  --->  ID: ${t.id}`);
                    });
                    console.log('\n✅ Copia estos IDs y ponlos en src/many-chat/tags.ts');
                } else {
                    console.error('❌ Error de ManyChat:', json);
                }
            } catch (e) { console.error(e); }
        });
    });
} catch (e) { 
    console.log('❌ Error: ' + e.message); 
    console.log('Asegurate de que el archivo .env exista en esta carpeta.');
}
