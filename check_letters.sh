#!/bin/bash

check_rack() {
    local rack="$1"
    local vowels=0
    local consonants=0
    local blanks=0
    
    for (( i=0; i<${#rack}; i++ )); do
        char="${rack:$i:1}"
        case "$char" in
            A|E|I|O|U) ((vowels++)) ;;
            "?") ((blanks++)) ;;
            [A-Z]) ((consonants++)) ;;
        esac
    done
    
    echo "$rack: V=$vowels C=$consonants B=$blanks"
}

echo "Testing rack compositions:"
check_rack "BB?UDSD"
check_rack "AEIOUBC"
check_rack "BCDFGHI"
check_rack "??BCDEF"
check_rack "AEIOUXZ"
check_rack "AEIOUIO"
check_rack "BCDEFGH"
check_rack "B?CDEFG"
check_rack "A?EIOUU"
check_rack "AEIOUBF"
