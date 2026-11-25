# routeros/iran-edge.rsc — RouterOS v7 baseline for an Iran entry node (e.g. THR-EDGE-01)
# Replace every <PLACEHOLDER> before importing:  /import file-name=iran-edge.rsc

# ── 1. Customer-facing WireGuard (peers are added by the panel through REST) ──
/interface wireguard add name=wg-doping listen-port=51820 mtu=1420 comment="customers"
/ip address add address=10.10.10.1/24 interface=wg-doping

# ── 2. Backbone tunnel to the Oman exit node ──
/interface wireguard add name=wg-oman listen-port=51821 mtu=1420 comment="backbone THR->MCT"
/interface wireguard peers add interface=wg-oman public-key="<OMAN_PUBLIC_KEY>" \
    endpoint-address=<OMAN_PUBLIC_IP> endpoint-port=51821 allowed-address=0.0.0.0/0 persistent-keepalive=15s
/ip address add address=172.16.50.1/30 interface=wg-oman

# ── 3. Policy routing: only customer traffic leaves through Oman ──
/routing table add name=via-oman fib
/ip route add dst-address=0.0.0.0/0 gateway=172.16.50.2 routing-table=via-oman check-gateway=ping
/routing rule add src-address=10.10.10.0/24 action=lookup-only-in-table table=via-oman
# Doping game servers hosted in Iran stay on the domestic path (12 ms instead of a round trip to Oman)
/ip firewall address-list add list=doping-local-servers address=<GAME_SERVER_SUBNET>
/routing rule add src-address=10.10.10.0/24 dst-address=<GAME_SERVER_SUBNET> action=lookup table=main place-before=0

# ── 3b. Per-customer exit choice (panel → «نود خروجی») ──
# The panel keeps each subscription's tunnel addresses in one address-list per exit:
#   doping-exit-mct (Oman) · doping-exit-dxb (Dubai) · doping-exit-fra (Frankfurt).
# Mark them and route each mark through its backbone. Rules for exits you don't run can be left out;
# addresses in a list with no rule fall back to the default above.
/routing table add name=via-dubai fib
/routing table add name=via-frankfurt fib
/ip route add dst-address=0.0.0.0/0 gateway=<DUBAI_BACKBONE_GW> routing-table=via-dubai check-gateway=ping
/ip route add dst-address=0.0.0.0/0 gateway=<FRANKFURT_BACKBONE_GW> routing-table=via-frankfurt check-gateway=ping
/ip firewall mangle
add chain=prerouting in-interface=wg-doping src-address-list=doping-exit-dxb dst-address-list=!doping-local-servers action=mark-routing new-routing-mark=via-dubai passthrough=no comment="exit: Dubai"
add chain=prerouting in-interface=wg-doping src-address-list=doping-exit-fra dst-address-list=!doping-local-servers action=mark-routing new-routing-mark=via-frankfurt passthrough=no comment="exit: Frankfurt"
add chain=prerouting in-interface=wg-doping src-address-list=doping-exit-mct dst-address-list=!doping-local-servers action=mark-routing new-routing-mark=via-oman passthrough=no comment="exit: Oman"

# ── 4. MSS clamp so game and voice packets never fragment inside the tunnel ──
/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn in-interface=wg-doping \
    action=change-mss new-mss=clamp-to-pmtu passthrough=yes

# ── 5. Anti-sanction DNS: answers only for whitelisted customer IPs and tunnel users ──
/ip dns set allow-remote-requests=yes servers=172.16.50.2 cache-size=16384KiB
/ip firewall filter
add chain=input action=accept connection-state=established,related
add chain=input action=accept protocol=udp dst-port=51820,51821 comment="wireguard"
add chain=input action=accept protocol=udp dst-port=53 src-address-list=doping-dns-allowed comment="dns: whitelisted"
add chain=input action=accept protocol=tcp dst-port=53 src-address-list=doping-dns-allowed
add chain=input action=accept protocol=udp dst-port=53 in-interface=wg-doping comment="dns: tunnel users"
add chain=input action=accept protocol=tcp dst-port=8443 src-address-list=doping-panel comment="REST API: panel only"
add chain=input action=drop comment="default drop"

# ── 6. REST API hardening: TLS only, panel IP only, least-privilege account ──
/certificate add name=rest-cert common-name=thr-edge-01 key-size=prime256v1 days-valid=825
/certificate sign rest-cert
/ip service set www-ssl certificate=rest-cert port=8443 address=<PANEL_IP>/32 tls-version=only-1.2 disabled=no
/ip service set www,api,api-ssl,telnet,ftp disabled=yes
/ip firewall address-list add list=doping-panel address=<PANEL_IP>
/user group add name=doping-api policy=read,write,api,rest-api,!ftp,!ssh,!telnet,!reboot,!policy,!sensitive
/user add name=doping-api group=doping-api address=<PANEL_IP>/32 password="<LONG_RANDOM_PASSWORD>"
