<?php declare(strict_types=1);

namespace app\model;

class Apps extends Model {

    public function __construct() {
        parent::__construct();
    }

    public function list(): array {
        return [
            [
                "server" => "oci-server-1",
                "name" => "upload-pages-artifact",
                "description" => "Uma ação composite para empacotar e enviar um artefato que pode ser implantado no Github Pages.",
                "status" => "running",
                "publicUrl" => "https://upload-pages-artifact.appops.dev",
            ],
            [
                "server" => "oci-server-1",
                "name" => "appops",
                "description" => "Uma ferramenta para gerenciar a implantação de aplicações web e gerenciar servidores Dokku.",
                "status" => "running",
                "publicUrl" => "https://upload-pages-artifact.appops.dev",
            ],
            [
                "server" => "oci-server-2",
                "name" => "upload-pages-artifact-2",
                "description" => "Uma ação composite para empacotar e enviar um artefato que pode ser implantado no Github Pages.",
                "status" => "stopped",
                "publicUrl" => "https://upload-pages-artifact.appops.dev",
            ],
        ];
    }

    public function listFromServer(string $server): ?array {
        $apps = [];
        foreach($this->list() as $app) {
            if($app["server"] === $server) {
                $apps[] = $app;
            }
        }
        return $apps;
    }

    public function get(string $name): ?array {
        foreach($this->list() as $app) {
            if($app["name"] === $name) {
                return $app;
            }
        }
        return null;
    }

}