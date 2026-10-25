package com.pag.app.controller;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Endpoint de verificación. Sirve para comprobar que el backend responde
 * y que el frontend puede consumirlo sin bloqueo de CORS.
 */
@RestController
@RequestMapping("/api/health")
@CrossOrigin(origins = {
        "http://localhost:3000",
        "http://localhost:5500",
        "http://127.0.0.1:5500"
})
public class HealthController {

    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "pag-backend",
                "timestamp", Instant.now().toString());
    }
}
