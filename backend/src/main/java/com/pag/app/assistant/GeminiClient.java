package com.pag.app.assistant;

/**
 * Puerta de entrada al modelo de IA. Toda la comunicacion con Gemini vive
 * detras de esta interfaz: si Google cambia su API solo se toca la clase que
 * la implementa, y en las pruebas se sustituye por una simulada.
 */
public interface GeminiClient {

    /**
     * @param systemInstruction reglas fijas del asistente
     * @param userPrompt        pregunta del usuario con su contexto
     * @return el texto de la respuesta
     * @throws AssistantException si Gemini no esta disponible o rechaza la peticion
     */
    String generate(String systemInstruction, String userPrompt);
}
