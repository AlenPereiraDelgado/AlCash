/**
 * Servicio de Inteligencia Artificial para AlCash
 * Utiliza Google Gemini API para el procesamiento de lenguaje natural.
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

export const parseWithGemini = async (text, categories, apiKey) => {
    if (!apiKey) {
        throw new Error("API_KEY_MISSING");
    }

    const prompt = `
        Eres un experto en contabilidad personal para la app AlCash. 
        Analiza la siguiente frase y extrae un movimiento financiero en formato JSON puro.
        
        FRASE: "${text}"
        HOY ES: ${new Date().toISOString().split('T')[0]}
        
        CATEGORÍAS DISPONIBLES:
        - Gastos: ${Object.keys(categories.expense).join(', ')}
        - Ingresos: ${Object.keys(categories.income).join(', ')}
        
        REGLAS:
        1. Devuelve SOLO un objeto JSON válido.
        2. Campos: amountVal (número), date (YYYY-MM-DD), type ("expense" o "income"), category (debe ser una de las proporcionadas), note (descripción breve y limpia).
        3. Si la fecha es "ayer", calcula la fecha correcta.
        
        EJEMPLO DE SALIDA:
        {
            "amountVal": 15.50,
            "date": "2024-04-11",
            "type": "expense",
            "category": "Alimentación",
            "note": "Cena pizza"
        }
    `;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                }
            })
        });

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;
        return JSON.parse(resultText);
    } catch (error) {
        console.error("Error en Gemini API:", error);
        throw error;
    }
};
