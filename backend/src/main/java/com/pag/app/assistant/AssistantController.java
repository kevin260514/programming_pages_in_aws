package com.pag.app.assistant;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** POST /api/assistant: responde preguntas sobre lo que muestra la Pagina 2. */
@RestController
@RequestMapping("/api/assistant")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
})
public class AssistantController {

    private final AssistantService service;

    public AssistantController(AssistantService service) {
        this.service = service;
    }

    @PostMapping
    public AssistantResponse ask(@Valid @RequestBody AssistantRequest request, HttpServletRequest http) {
        return service.ask(clientKey(http.getHeader("X-Forwarded-For"), http.getRemoteAddr()), request);
    }

    /**
     * Identifica al cliente para el limite de uso. Detras de Nginx todas las
     * peticiones llegan desde la misma IP interna, asi que se usa la ultima
     * direccion de X-Forwarded-For: es la que agrega Nginx y el cliente no
     * puede falsificarla.
     */
    static String clientKey(String forwardedFor, String remoteAddr) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] hops = forwardedFor.split(",");
            return hops[hops.length - 1].trim();
        }
        return remoteAddr;
    }
}
