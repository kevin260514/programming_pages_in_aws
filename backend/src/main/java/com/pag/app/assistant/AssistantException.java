package com.pag.app.assistant;

import org.springframework.http.HttpStatus;

/**
 * Error controlado del asistente. Lleva el estado HTTP que debe recibir el
 * frontend y un mensaje listo para mostrarle al usuario.
 */
public class AssistantException extends RuntimeException {

    private final HttpStatus status;

    public AssistantException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
